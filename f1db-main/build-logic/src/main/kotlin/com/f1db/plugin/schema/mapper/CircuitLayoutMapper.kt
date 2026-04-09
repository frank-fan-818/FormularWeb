package com.f1db.plugin.schema.mapper

import com.f1db.plugin.schema.single.Circuit
import com.f1db.plugin.schema.single.CircuitLayout
import org.mapstruct.AfterMapping
import org.mapstruct.Context
import org.mapstruct.Mapper
import org.mapstruct.Mapping
import org.mapstruct.MappingTarget
import com.f1db.plugin.schema.splitted.CircuitLayout as SplittedCircuitLayout

/**
 * The circuit layout mapper.
 *
 * @author Marcel Overdijk
 */
@Mapper
interface CircuitLayoutMapper {

    @Mapping(target = "circuitId", ignore = true)
    fun toSplittedCircuitLayout(circuitLayout: CircuitLayout, @Context circuit: Circuit): SplittedCircuitLayout

    fun toSplittedCircuitLayouts(circuitLayouts: List<CircuitLayout>, @Context circuit: Circuit): List<SplittedCircuitLayout>

    @AfterMapping
    fun afterMapping(@MappingTarget splittedCircuitLayout: SplittedCircuitLayout, @Context circuit: Circuit) {
        splittedCircuitLayout.circuitId = circuit.id
    }
}
