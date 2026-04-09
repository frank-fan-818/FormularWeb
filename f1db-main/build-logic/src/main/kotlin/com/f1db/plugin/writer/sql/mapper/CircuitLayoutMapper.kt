package com.f1db.plugin.writer.sql.mapper

import com.f1db.plugin.schema.splitted.CircuitLayout
import com.f1db.plugin.writer.sql.tables.records.CircuitLayoutRecord
import org.jooq.RecordUnmapper
import org.mapstruct.Mapper
import org.mapstruct.ReportingPolicy

/**
 * The circuit layout mapper.
 *
 * @author Marcel Overdijk
 */
@Mapper(unmappedTargetPolicy = ReportingPolicy.ERROR)
interface CircuitLayoutMapper : RecordUnmapper<CircuitLayout, CircuitLayoutRecord> {

    override fun unmap(source: CircuitLayout): CircuitLayoutRecord

    fun unmap(sources: List<CircuitLayout>): List<CircuitLayoutRecord>
}
