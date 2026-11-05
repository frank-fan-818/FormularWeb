package com.formularone.nativeapp.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SessionCipher(private val key: () -> SecretKey) {
    private val aad = "FrankPitwall-session-v1".toByteArray()
    fun encrypt(value: String): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key()); cipher.updateAAD(aad)
        require(cipher.iv.size == 12)
        return byteArrayOf(1) + cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    }
    fun decrypt(value: ByteArray): String {
        require(value.size in 30..64_000 && value[0] == 1.toByte())
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, value.copyOfRange(1, 13))); cipher.updateAAD(aad)
        return cipher.doFinal(value.copyOfRange(13, value.size)).toString(Charsets.UTF_8)
    }
}
class EncryptedSessionStore(directory: File) : SessionStore {
    private val file = File(directory, "member-session.bin")
    private val cipher = SessionCipher {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("FrankPitwallSessionV1", null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("FrankPitwallSessionV1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        }.generateKey()
    }
    @Synchronized override fun read(): String? {
        if (!file.exists()) return null
        return try { require(file.length() <= 64_000); cipher.decrypt(file.readBytes()) }
        catch (_: Exception) { file.delete(); null }
    }
    @Synchronized override fun write(value: String?) {
        if (value == null) { file.delete(); File(file.parentFile, "member-session.tmp").delete(); return }
        file.parentFile?.mkdirs()
        val temp = File(file.parentFile, "member-session.tmp")
        temp.writeBytes(cipher.encrypt(value))
        Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }
}
