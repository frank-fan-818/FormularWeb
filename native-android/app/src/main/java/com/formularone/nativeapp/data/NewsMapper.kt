package com.formularone.nativeapp.data

import com.formularone.nativeapp.model.NewsItem
import com.formularone.nativeapp.model.NewsSource
import org.w3c.dom.Element
import org.xml.sax.InputSource
import java.io.StringReader
import javax.xml.parsers.DocumentBuilderFactory

object NewsMapper {
    fun parse(xml: String, source: NewsSource): List<NewsItem> {
        require(!Regex("<!\\s*(DOCTYPE|ENTITY)", RegexOption.IGNORE_CASE).containsMatchIn(xml))
        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true; isExpandEntityReferences = false }
        listOf("http://xml.org/sax/features/external-general-entities", "http://xml.org/sax/features/external-parameter-entities").forEach { feature -> runCatching { factory.setFeature(feature, false) } }
        val builder = factory.newDocumentBuilder().apply { setEntityResolver { _, _ -> InputSource(StringReader("")) } }
        val document = builder.parse(InputSource(StringReader(xml)))
        val entries = document.getElementsByTagNameNS("*", if (source == NewsSource.REDDIT) "entry" else "item")
        fun plain(value: String) = value.replace(Regex("<[^>]*>"), " ").replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ").replace(Regex("\\s+"), " ").trim()
        return (0 until entries.length).mapNotNull { index ->
            val element = entries.item(index) as? Element ?: return@mapNotNull null
            fun text(name: String) = element.getElementsByTagNameNS("*", name).item(0)?.textContent.orEmpty()
            val links = element.getElementsByTagNameNS("*", "link")
            val link = if (source == NewsSource.REDDIT) (0 until links.length).map { links.item(it) as Element }.firstOrNull { it.getAttribute("rel") in listOf("", "alternate") }?.getAttribute("href").orEmpty() else text("link")
            val safeLink = FeatureMapper.safeUrl(link.trim(), source.hosts) ?: return@mapNotNull null
            val title = plain(text("title")).take(500); if (title.isBlank()) return@mapNotNull null
            NewsItem(safeLink, title, plain(text("description").ifBlank { text("content") }).take(700), safeLink, text("pubDate").ifBlank { text("updated") }.take(80))
        }.distinctBy { it.id }.take(if (source == NewsSource.REDDIT) 50 else 200)
    }
}
