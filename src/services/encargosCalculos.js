export function calcularSimulacaoComEncargos(duplicatasVencidas, selecionadas, encargos, tipoAcordo, parcelas) {
    const itens = duplicatasVencidas.filter((d) => selecionadas.includes(d.id));
    if (itens.length === 0) return null;

    const subtotalBruto = itens.reduce((acc, d) => acc + d.valor, 0);
    const diasAtrasoMax = Math.max(...itens.map((d) => d.diasAtraso));

    // Buscar encargos ativos
    const encargosAtivos = encargos.filter(e => e.ativo);

    const jurosmensal = encargosAtivos.find(e => e.tipo === 'juros_mensal')?.valor || 0;
    const jurosParcelamento = encargosAtivos.find(e => e.tipo === 'juros_parcelamento')?.valor || 0;
    const jurosMora = encargosAtivos.find(e => e.tipo === 'juros_mora')?.valor || 0;
    const multa = encargosAtivos.find(e => e.tipo === 'multa')?.valor || 0;
    const honorarios = encargosAtivos.find(e => e.tipo === 'honorarios')?.valor || 0;
    const entrada = encargosAtivos.find(e => e.tipo === 'entrada')?.valor || 0;

    const entradaAjustada = Math.min(entrada, subtotalBruto);
    const subtotal = subtotalBruto - entradaAjustada;

    // Calcular multa e honorários sobre subtotal
    const multaValor = (subtotal * multa) / 100;
    const honorariosValor = (subtotal * honorarios) / 100;

    if (tipoAcordo === "avista") {
        // Juros simples sobre subtotal
        const jurosValor = (subtotal * jurosmensal) / 100;
        const totalComEncargos = subtotal + jurosValor + multaValor + honorariosValor;

        return {
            subtotalBruto,
            entrada: entradaAjustada,
            subtotal,
            juros: jurosValor,
            jurosMora,
            multa: multaValor,
            honorarios: honorariosValor,
            totalComEncargos,
            totalFinal: totalComEncargos,
            numParcelas: 1,
            valorParcela: totalComEncargos,
            diasAtrasoMax,
        };
    }

    // PARCELADO
    const baseCalculo = subtotal + multaValor + honorariosValor;
    const n = parcelas;

    // Calcular juros mensal (taxa de juros)
    const taxaMensalJurosmensal = jurosmensal / 100;
    const encargoJurosmensal = encargosAtivos.find(e => e.tipo === 'juros_mensal');
    const isCompostoJurosmensal = encargoJurosmensal?.compostoSimples === 'composto';

    let jurosValorMensal = 0;
    if (taxaMensalJurosmensal > 0) {
        if (isCompostoJurosmensal) {
            const fator = Math.pow(1 + taxaMensalJurosmensal, n);
            jurosValorMensal = baseCalculo * (fator - 1);
        } else {
            jurosValorMensal = baseCalculo * taxaMensalJurosmensal * n;
        }
    }

    // Calcular juros de parcelamento
    const taxaMensalParcelamento = jurosParcelamento / 100;
    const encargoJurosParcelamento = encargosAtivos.find(e => e.tipo === 'juros_parcelamento');
    const isCompostoParcelamento = encargoJurosParcelamento?.compostoSimples === 'composto';

    let jurosValorParcelamento = 0;
    const baseComJurosMensal = baseCalculo + jurosValorMensal;
    if (taxaMensalParcelamento > 0) {
        if (isCompostoParcelamento) {
            const fator = Math.pow(1 + taxaMensalParcelamento, n);
            jurosValorParcelamento = baseComJurosMensal * (fator - 1);
        } else {
            jurosValorParcelamento = baseComJurosMensal * taxaMensalParcelamento * n;
        }
    }

    const jurosValorTotal = jurosValorMensal + jurosValorParcelamento;
    const totalFinal = baseCalculo + jurosValorTotal;
    const valorParcela = totalFinal / n;

    return {
        subtotalBruto,
        entrada: entradaAjustada,
        subtotal,
        juros: jurosValorTotal,
        jurosMora,
        multa: multaValor,
        honorarios: honorariosValor,
        totalComEncargos: totalFinal,
        totalFinal,
        numParcelas: n,
        valorParcela,
        diasAtrasoMax,
    };
}

export function obterEncargosParaDocumento(encargos) {
    const encargosAtivos = encargos.filter(e => e.ativo);

    return {
        jurosmensal: encargosAtivos.find(e => e.tipo === 'juros_mensal')?.valor || 0,
        jurosParcelamento: encargosAtivos.find(e => e.tipo === 'juros_parcelamento')?.valor || 0,
        jurosMora: encargosAtivos.find(e => e.tipo === 'juros_mora')?.valor || 0,
        multa: encargosAtivos.find(e => e.tipo === 'multa')?.valor || 0,
        honorarios: encargosAtivos.find(e => e.tipo === 'honorarios')?.valor || 0,
    };
}
