import axios from "axios";
import extenso from "extenso";
import { getBranchLabel } from "../constants/branches.js";

const viacepClient = axios.create({
    baseURL: "https://viacep.com.br/ws",
    timeout: 5000,
});

const cepCache = new Map();

const formatCnpj = (cnpj) => {
    if (!cnpj) return "";
    const clean = String(cnpj).replace(/\D/g, "");

    if (clean.length === 11) {
        return clean.replace(
            /(\d{3})(\d{3})(\d{3})(\d{2})/,
            "$1.$2.$3-$4"
        );
    }

    if (clean.length !== 14) return cnpj;

    return clean.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        "$1.$2.$3/$4-$5"
    );
};

const formatPhone = (phone) => {
    if (!phone) return "";

    const clean = String(phone).replace(/\D/g, "");

    if (clean.length === 10) {
        return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }

    if (clean.length === 11) {
        return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }

    return phone;
};

const formatDate = (dateString) => {
    if (!dateString) return "";

    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) return "";

        return date.toLocaleDateString("pt-BR");
    } catch {
        return "";
    }
};

// Compara em centavos (arredondado) pra não cair em erro de ponto flutuante
// — ex: 290.60 - 35.23 pode virar 255.36999999999998 em JS e marcar como
// "Pago Parcialmente" uma parcela que na verdade já foi liquidada certinho.
const pagoParcialmente = (doc) => {
    const valorLiquidado = (doc.paidValue || 0) + (doc.discountValue || 0);
    const centavosLiquidado = Math.round(valorLiquidado * 100);
    const centavosParcela = Math.round((doc.installmentValue || 0) * 100);
    return centavosLiquidado < centavosParcela;
};

const diffEmDias = (dataMaisRecente, dataMaisAntiga) => {
    const recente = new Date(dataMaisRecente);
    recente.setHours(0, 0, 0, 0);

    const antiga = new Date(dataMaisAntiga);
    antiga.setHours(0, 0, 0, 0);

    return Math.floor((recente - antiga) / 86400000);
};

// O atraso de um documento nunca vem do "calculatedValues.daysLate" da API — esse
// campo reflete o atraso até HOJE mesmo pra títulos já pagos, e sem zerar o horário
// ele diverge por 1 dia dependendo do fuso/hora em que a conta é feita. Calculando
// sempre a partir das datas reais, o Resumo de Crédito e a tabela nunca destoam.
const diasAtrasoDocumento = (doc) => {
    if (doc.paymentDate) {
        return Math.max(diffEmDias(doc.paymentDate, doc.expiredDate), 0);
    }
    return Math.max(diffEmDias(new Date(), doc.expiredDate), 0);
};

const sanitizeCep = (cep) => {
    if (!cep) return "";
    return String(cep).replace(/\D/g, "");
};

async function consultarCep(cep) {
    const cepLimpo = sanitizeCep(cep);

    if (cepLimpo.length !== 8) {
        return null;
    }

    if (cepCache.has(cepLimpo)) {
        return cepCache.get(cepLimpo);
    }

    try {
        const { data } = await viacepClient.get(`/${cepLimpo}/json/`);

        if (!data || data.erro) {
            cepCache.set(cepLimpo, null);
            return null;
        }

        cepCache.set(cepLimpo, data);
        return data;
    } catch {
        cepCache.set(cepLimpo, null);
        return null;
    }
}

async function obterBairroPorCep(cep) {
    const data = await consultarCep(cep);
    return data?.bairro || "";
}

const formatValorExtensoAutomatico = (valor) => {
    if (!valor || valor === 0) return "zero";

    try {
        return extenso(valor, { mode: "currency" });
    } catch {
        return String(valor);
    }
};

export const mapLegalEntityToDadosCadastrais = async (legalEntity) => {
    if (!legalEntity) return null;

    const address = legalEntity.addresses?.[0];
    const phone = legalEntity.phones?.[0];
    const email = legalEntity.emails?.[0];
    const classification = legalEntity.classifications?.[0];

    let bairro = address?.district || address?.neighborhood || "";

    if (!bairro && address?.cep) {
        bairro = await obterBairroPorCep(address.cep);
    }

    return {
        razaoSocial: legalEntity.name || "",
        nomeFantasia: legalEntity.fantasyName || "",
        cnpj: formatCnpj(legalEntity.cnpj || legalEntity.cpf),
        codigoCliente: legalEntity.code || "",
        inscricaoEstadual: legalEntity.numberStateRegistration || "",

        rua: address?.address || "",
        numero: address?.addressNumber?.toString() || "",
        complemento: address?.complement || "",
        bairro: bairro || "",
        municipio: address?.cityName || "",
        cidade: address?.cityName || "",
        estado: address?.stateAbbreviation || "",
        cep: address?.cep || "",

        endereco: address
            ? `${address.address || ""}${address.addressNumber ? ", " + address.addressNumber : ""}${address.complement ? " " + address.complement : ""
                }`.trim()
            : "",

        telefoneFixo: formatPhone(phone?.number),
        whatsapp: formatPhone(phone?.number),
        email: email?.email || "",
        divisaoNegocios: classification?.name || "",
        dataAbertura: legalEntity.insertDate ? formatDate(legalEntity.insertDate) : "---",
        situacao: legalEntity.isInactive ? "Inativa" : "Ativa",
    };
};

const calculateAverageDelayLast12Months = (documents) => {
    if (!documents || documents.length === 0) return 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const umAnoAtras = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());

    const relevantDocuments = documents.filter((doc) => {
        const vencimento = new Date(doc.expiredDate);
        vencimento.setHours(0, 0, 0, 0);

        if (vencimento < umAnoAtras) return false;

        return diasAtrasoDocumento(doc) > 0;
    });

    if (relevantDocuments.length === 0) return 0;

    const totalDiasAtraso = relevantDocuments.reduce(
        (soma, doc) => soma + diasAtrasoDocumento(doc),
        0
    );

    return Math.round(totalDiasAtraso / relevantDocuments.length);
};

const calculateMaxDelay = (documents) => {
    if (!documents || documents.length === 0) return 0;

    const delays = documents.map(diasAtrasoDocumento).filter((dias) => dias > 0);

    return delays.length > 0 ? Math.max(...delays) : 0;
};

const countOverdueTitles = (documents) => {
    if (!documents || documents.length === 0) return 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return documents.filter((doc) => {
        if (doc.paymentDate) return false;

        const vencimento = new Date(doc.expiredDate);
        vencimento.setHours(0, 0, 0, 0);
        return vencimento < hoje;
    }).length;
};

const countDueTitles = (documents) => {
    if (!documents || documents.length === 0) return 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return documents.filter((doc) => {
        if (doc.paymentDate) return false;

        const vencimento = new Date(doc.expiredDate);
        vencimento.setHours(0, 0, 0, 0);
        return vencimento >= hoje;
    }).length;
};

// status 1 = Normal; 2 = Devolvido, 3 = Cancelado, 4 = Quebrada. Qualquer
// status diferente de Normal sai das contagens/somas dos cards do Resumo de
// Crédito — só título "normal" representa risco de crédito real.
const documentoEhNormal = (doc) => doc.status == null || doc.status === 1;

const STATUS_ESPECIAL_LABEL = {
    2: "Devolvido",
    3: "Cancelado",
    4: "Quebrada",
};

const statusEspecial = (status) => STATUS_ESPECIAL_LABEL[status] || null;

const chaveGrupoFaturaFilial6 = (doc) => `${doc.receivableCode}|${doc.issueDate}`;

// Compara um vínculo retornado pela validação da filial 6 com o doc original
// (esse original já vem filtrado pelo cliente que estamos consultando).
const ehVinculoDoClientePesquisado = (item, doc) => {
    if (doc.customerCode != null && item.customerCode != null) {
        return item.customerCode === doc.customerCode;
    }
    return Boolean(doc.customerCpfCnpj) && item.customerCpfCnpj === doc.customerCpfCnpj;
};

// A filial 6 valida cada fatura sem filtrar por cliente, então o mesmo grupo
// pode trazer vários vínculos (clientes) pra mesma fatura+data. Pra contagem
// de vencidos/a vencer, cada vínculo pesa separado — é risco de crédito real,
// mesmo que apareçam concentrados numa única fatura nossa. Sem achatar, cada
// fatura da filial 6 só contaria 1 vez, escondendo vínculos vencidos extras.
// O vínculo do próprio cliente pesquisado não entra nessa soma — só os
// vínculos dos OUTROS clientes daquela fatura compartilhada contam pro risco.
const achatarDocumentosParaAgregado = (documents) => {
    if (!documents?.items) return [];

    const gruposProcessados = new Set();
    const achatados = [];

    documents.items.forEach((doc) => {
        if (doc.branchCode === 6 && doc.validacaoFilial6?.items?.length > 0) {
            const chave = chaveGrupoFaturaFilial6(doc);
            if (gruposProcessados.has(chave)) return;
            gruposProcessados.add(chave);
            const vinculosDeOutrosClientes = doc.validacaoFilial6.items.filter(
                (item) => !ehVinculoDoClientePesquisado(item, doc)
            );
            // A exclusão só vale quando a fatura é compartilhada entre clientes
            // diferentes. Se todo mundo ali é o próprio cliente pesquisado (0
            // vínculos de outros), não tem "outro" pra representar o risco —
            // conta normalmente os vínculos dele mesmo, não descarta a fatura.
            achatados.push(...(vinculosDeOutrosClientes.length > 0 ? vinculosDeOutrosClientes : doc.validacaoFilial6.items));
            return;
        }
        achatados.push(doc);
    });

    return achatados.filter(documentoEhNormal);
};

export const mapFinancialBalanceToResumoCredito = (financialBalance, documents) => {
    if (!financialBalance || !financialBalance.items?.[0]) return null;

    const balanceItem = financialBalance.items[0];
    const values = balanceItem.values || [];

    let totalLimitValue = 0;
    let totalOpenInvoiceValue = 0;
    let totalRefundCreditValue = 0;
    let totalAdvanceAmountValue = 0;
    let lastChangeLimitDate = null;

    values.forEach((v) => {
        totalLimitValue += v.limitValue || 0;
        totalOpenInvoiceValue += v.openInvoiceValue || 0;
        totalRefundCreditValue += v.refundCreditValue || 0;
        totalAdvanceAmountValue += v.advanceAmountValue || 0;

        if (v.lastChangeLimitDate) {
            lastChangeLimitDate = v.lastChangeLimitDate;
        }
    });

    const parcelsData = achatarDocumentosParaAgregado(documents);
    let parcelsOverdue = 0;
    let parcelsDueDate = 0;
    let totalDesconto = 0;

    parcelsData.forEach((doc) => {
        totalDesconto += doc.discountValue || 0;

        // Sem descontar discountValue, uma parcela já liquidada (pago + desconto
        // = parcela) sobra com um "saldo devedor" fantasma do tamanho do desconto,
        // e entra em Parcelas Vencidas/A Vencer mesmo já estando paga.
        const saldoDevedorCentavos = Math.round(
            ((doc.installmentValue || 0) - (doc.paidValue || 0) - (doc.discountValue || 0)) * 100
        );

        if (saldoDevedorCentavos > 0) {
            const saldoDevedor = saldoDevedorCentavos / 100;

            if (new Date(doc.expiredDate) < new Date()) {
                parcelsOverdue += saldoDevedor;
            } else {
                parcelsDueDate += saldoDevedor;
            }
        }

    });

    const prazoMedioAtraso = calculateAverageDelayLast12Months(parcelsData);
    const countParcelasVencidas = countOverdueTitles(parcelsData);
    const countParcelasAVencer = countDueTitles(parcelsData);
    const maiorAtraso = calculateMaxDelay(parcelsData);

    return {
        limiteCreditoTotal: totalLimitValue,
        limiteCreditoUtilizado: totalOpenInvoiceValue,
        parcelasVencidas: parcelsOverdue,
        parcelasAVencer: parcelsDueDate,
        limiteDisponivel: totalLimitValue - totalOpenInvoiceValue,
        saldoCredevEmAberto: totalRefundCreditValue,
        antecipacaoEmAberto: totalAdvanceAmountValue,
        totalDesconto,
        prazoMedioCarteira: 0,
        prazoMedioFat60d: 0,
        prazoMedioAtraso12m: prazoMedioAtraso,
        dataUltimaRevisao: lastChangeLimitDate ? formatDate(lastChangeLimitDate) : "---",
        pedidosAEntregar: countParcelasAVencer,
        totalPedidosAEntregar: parcelsDueDate,
        countParcelasVencidas,
        maiorAtraso,
    };
};

export const mapDocumentsToDuplicatas = (documents) => {
    if (!documents || !documents.items) return [];

    const totalParcelasPorDuplicata = documents.items.reduce((acc, doc) => {
        acc[doc.receivableCode] = (acc[doc.receivableCode] || 0) + 1;
        return acc;
    }, {});

    return documents.items.map((doc) => {
        const totalParcelas = totalParcelasPorDuplicata[doc.receivableCode] || 1;
        // Devolvido/Cancelado/Quebrada não representam mais um título em
        // aberto correndo atraso, então não faz sentido calcular dias de atraso.
        const diasAtraso = statusEspecial(doc.status) ? 0 : diasAtrasoDocumento(doc);
        const ehPagoParcialmente = Boolean(doc.paymentDate) && pagoParcialmente(doc);

        const statusPagamento = statusEspecial(doc.status) || (() => {
            if (doc.paymentDate) {
                if (ehPagoParcialmente) return "Pago Parcialmente";
                return diasAtraso > 0 ? "Pago com Atraso" : "Pago";
            }

            const expired = new Date(doc.expiredDate);
            expired.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (expired.getTime() === today.getTime()) return "Vence Hoje";
            return expired < today ? "Vencido" : "A Vencer";
        })();

        return {
            id: `${doc.receivableCode}-${doc.installmentCode}`,
            duplicata: doc.ourNumber?.toString() || "-",
            fatura: doc.receivableCode?.toString() || "-",
            parcela: doc.installmentCode ? `${doc.installmentCode}/${totalParcelas}` : "",
            valor: doc.installmentValue || 0,
            valorDesc: doc.discountValue || 0,
            valorPag: doc.paidValue || 0,
            dataEmissao: doc.issueDate
                ? new Date(doc.issueDate).toLocaleDateString("pt-BR")
                : "",
            dataVencimento: doc.expiredDate
                ? new Date(doc.expiredDate).toLocaleDateString("pt-BR")
                : "",
            dataPagamento: doc.paymentDate
                ? new Date(doc.paymentDate).toLocaleDateString("pt-BR")
                : null,
            diasAtraso,
            statusPagamento,
            conta: doc.bearerName || "",
            filial: doc.branchCode != null ? getBranchLabel(doc.branchCode) : "---",
            validacaoFilial6: doc.validacaoFilial6 || null,
            customerCode: doc.customerCode ?? null,
            customerCpfCnpj: doc.customerCpfCnpj || "",
        };
    });
};

// Não busca nada novo — reaproveita o mesmo financialData já buscado pro Resumo
// de Crédito, que já pede isRefundCredit:true e por isso já traz esse valor.
export const mapFinancialBalanceToSaldoCredev = (financialBalance) => {
    if (!financialBalance || !financialBalance.items?.[0]) return null;

    const values = financialBalance.items[0].values || [];

    const porFilial = values
        .filter((v) => v.branchCode != null)
        .map((v) => ({
            filial: getBranchLabel(v.branchCode),
            saldo: v.refundCreditValue || 0,
        }));

    const total = values.reduce((soma, v) => soma + (v.refundCreditValue || 0), 0);

    return { total, porFilial };
};

export const mapOrdersToNotasVenda = (orders) => {
    if (!orders || !orders.items) return [];

    return orders.items.map((order) => {
        const invoices = order.invoices || [];
        const primeiraInvoice = invoices[0] || {};

        return {
            id: `${order.orderCode ?? ""}`,
            pedido: order.orderCode?.toString() || "-",
            codigoMarketplace: order.customerOrderCode || order.orderId || "-",
            valorTotal: order.totalAmountOrder || 0,
            notaFiscal: primeiraInvoice.code?.toString() || "-",
            representante: order.representativeName || "-",
            data: order.orderDate ? new Date(order.orderDate).toLocaleDateString("pt-BR") : "-",
        };
    });
};

export const mapFiscalInvoicesToNotasDevolucao = (invoices) => {
    if (!invoices || !invoices.items) return [];

    return invoices.items.map((nota) => ({
        id: `${nota.invoiceCode ?? nota.transactionCode ?? ""}`,
        notaFiscal: nota.invoiceCode?.toString() || "-",
        operacao: nota.operatioName || "-",
        valor: nota.totalValue || 0,
        emissao: nota.issueDate ? new Date(nota.issueDate).toLocaleDateString("pt-BR") : "-",
        statusSefaz: nota.eletronic?.electronicInvoiceStatus || "-",
    }));
};

const descreverBaixaCredev = (dischargeType) => {
    switch (dischargeType) {
        case 0:
            return "Crédito parado";
        case 31:
            return "Baixa cartão com CREDEV";
        default:
            return dischargeType != null ? "Baixado" : "-";
    }
};

export const mapDocumentsToCredevTitulos = (documents) => {
    if (!documents || !documents.items) return [];

    return documents.items.map((doc) => ({
        id: `${doc.receivableCode}-${doc.installmentCode}`,
        fatura: doc.receivableCode?.toString() || "-",
        valor: doc.installmentValue || 0,
        dataEmissao: doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("pt-BR") : "-",
        statusBaixa: descreverBaixaCredev(doc.dischargeType),
        portador: doc.bearerName || "-",
        filial: doc.branchCode != null ? getBranchLabel(doc.branchCode) : "---",
    }));
};

export const mapDocumentsToNotasDebito = (documents) => {
    if (!documents || !documents.items) return [];

    return documents.items.map((doc) => ({
        id: `${doc.receivableCode}-${doc.installmentCode}`,
        fatura: doc.receivableCode?.toString() || "-",
        valor: doc.installmentValue || 0,
        dataEmissao: doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("pt-BR") : "-",
        dataVencimento: doc.expiredDate ? new Date(doc.expiredDate).toLocaleDateString("pt-BR") : "-",
        status: doc.status || "-",
        portador: doc.bearerName || "-",
    }));
};

export const buildInitialPartes = (dadosCadastrais = {}) => ({
    notificado: {
        nome: dadosCadastrais?.razaoSocial || "",
        cnpj: dadosCadastrais?.cnpj || "",
        rua: dadosCadastrais?.rua || "",
        numero: dadosCadastrais?.numero || "",
        bairro: dadosCadastrais?.bairro || "",
        municipio: dadosCadastrais?.municipio || dadosCadastrais?.cidade || "",
        estado: dadosCadastrais?.estado || "",
        cep: dadosCadastrais?.cep || "",
    },
    socio: {
        nome: "",
        nacionalidade: "",
        estadoCivil: "",
        profissao: "",
        rg: "",
        orgaoEmissor: "",
        cpf: "",
        rua: "",
        numero: "",
        bairro: "",
        municipio: "",
        estado: "",
        cep: "",
    },
    avalista: {
        nome: "",
        nacionalidade: "",
        estadoCivil: "",
        profissao: "",
        rg: "",
        orgaoEmissor: "",
        cpf: "",
        rua: "",
        numero: "",
        bairro: "",
        municipio: "",
        estado: "",
        cep: "",
    },
    devedorSolidario: {
        nome: "",
        nacionalidade: "",
        estadoCivil: "",
        profissao: "",
        rg: "",
        orgaoEmissor: "",
        cpf: "",
        rua: "",
        numero: "",
        bairro: "",
        municipio: "",
        estado: "",
        cep: "",
    },
    testemunha1: {
        nome: "DAYANE RODRIGUES DANTAS GALINDO",
        cpf: "099.451.079-92",
    },
    testemunha2: {
        nome: "LUIZ FILIPE FERRAZ GONÇALVES",
        cpf: "064.349.969-50",
    },
});

const fillEmptyWithUnderscore = (value) => {
    if (!value || (typeof value === "string" && value.trim() === "")) {
        return "_____";
    }
    return value;
};

export const mapPartesToTemplateVariables = (partes = {}) => {
    const notificado = partes.notificado || {};
    const socio = partes.socio || {};
    const avalista = partes.avalista || {};
    const devedorSolidario = partes.devedorSolidario || {};

    return {
        NOME_NOT: fillEmptyWithUnderscore(notificado.nome),
        CNPJ_NOT: fillEmptyWithUnderscore(notificado.cnpj),
        RUA_NOT: fillEmptyWithUnderscore(notificado.rua),
        NUMERO_NOT: fillEmptyWithUnderscore(notificado.numero),
        BAIRRO_NOT: fillEmptyWithUnderscore(notificado.bairro),
        MUNICIPIO_NOT: fillEmptyWithUnderscore(notificado.municipio),
        ESTADO_NOT: fillEmptyWithUnderscore(notificado.estado),
        CEP_NOT: fillEmptyWithUnderscore(notificado.cep),

        NOME_SOC: fillEmptyWithUnderscore(socio.nome),
        NACIONALIDADE_SOC: fillEmptyWithUnderscore(socio.nacionalidade),
        ESTADO_CIVIL_SOC: fillEmptyWithUnderscore(socio.estadoCivil),
        PROFISSAO_SOC: fillEmptyWithUnderscore(socio.profissao),
        RG_SOC: fillEmptyWithUnderscore(socio.rg),
        ORGAO_EMISSOR_SOC: fillEmptyWithUnderscore(socio.orgaoEmissor),
        CPF_SOC: fillEmptyWithUnderscore(socio.cpf),
        RUA_SOC: fillEmptyWithUnderscore(socio.rua),
        NUMERO_SOC: fillEmptyWithUnderscore(socio.numero),
        BAIRRO_SOC: fillEmptyWithUnderscore(socio.bairro),
        MUNICIPIO_SOC: fillEmptyWithUnderscore(socio.municipio),
        ESTADO_SOC: fillEmptyWithUnderscore(socio.estado),
        CEP_SOC: fillEmptyWithUnderscore(socio.cep),

        NOME_AVA: fillEmptyWithUnderscore(avalista.nome),
        NACIONALIDADE_AVA: fillEmptyWithUnderscore(avalista.nacionalidade),
        ESTADO_CIVIL_AVA: fillEmptyWithUnderscore(avalista.estadoCivil),
        PROFISSAO_AVA: fillEmptyWithUnderscore(avalista.profissao),
        RG_AVA: fillEmptyWithUnderscore(avalista.rg),
        ORGAO_EMISSOR_AVA: fillEmptyWithUnderscore(avalista.orgaoEmissor),
        CPF_AVA: fillEmptyWithUnderscore(avalista.cpf),
        RUA_AVA: fillEmptyWithUnderscore(avalista.rua),
        NUMERO_AVA: fillEmptyWithUnderscore(avalista.numero),
        BAIRRO_AVA: fillEmptyWithUnderscore(avalista.bairro),
        MUNICIPIO_AVA: fillEmptyWithUnderscore(avalista.municipio),
        ESTADO_AVA: fillEmptyWithUnderscore(avalista.estado),
        CEP_AVA: fillEmptyWithUnderscore(avalista.cep),

        NOME_DEV: fillEmptyWithUnderscore(devedorSolidario.nome),
        NACIONALIDADE_DEV: fillEmptyWithUnderscore(devedorSolidario.nacionalidade),
        ESTADO_CIVIL_DEV: fillEmptyWithUnderscore(devedorSolidario.estadoCivil),
        PROFISSAO_DEV: fillEmptyWithUnderscore(devedorSolidario.profissao),
        RG_DEV: fillEmptyWithUnderscore(devedorSolidario.rg),
        ORGAO_EMISSOR_DEV: fillEmptyWithUnderscore(devedorSolidario.orgaoEmissor),
        CPF_DEV: fillEmptyWithUnderscore(devedorSolidario.cpf),
        RUA_DEV: fillEmptyWithUnderscore(devedorSolidario.rua),
        NUMERO_DEV: fillEmptyWithUnderscore(devedorSolidario.numero),
        BAIRRO_DEV: fillEmptyWithUnderscore(devedorSolidario.bairro),
        MUNICIPIO_DEV: fillEmptyWithUnderscore(devedorSolidario.municipio),
        ESTADO_DEV: fillEmptyWithUnderscore(devedorSolidario.estado),
        CEP_DEV: fillEmptyWithUnderscore(devedorSolidario.cep),

        NOME_TES_1: fillEmptyWithUnderscore(partes.testemunha1?.nome),
        CPF_TES_1: fillEmptyWithUnderscore(partes.testemunha1?.cpf),
        NOME_TES_2: fillEmptyWithUnderscore(partes.testemunha2?.nome),
        CPF_TES_2: fillEmptyWithUnderscore(partes.testemunha2?.cpf),
    };
};

export const calcularMultas = (
    subtotal = 0,
    percentualMulta = 0,
    percentualMultaHonoraria = 0
) => {
    const multa = (subtotal * percentualMulta) / 100;
    const multaHonoraria = (subtotal * percentualMultaHonoraria) / 100;

    return {
        multa,
        multaHonoraria,
        totalMultas: multa + multaHonoraria,
    };
};

export const mapDuplicatasParaTabela = (duplicatas = []) => {
    if (!duplicatas || duplicatas.length === 0) {
        return [];
    }

    return duplicatas.map((dup) => ({
        DUPLICATA: dup.duplicata || "",
        PARCELA: dup.parcela || "",
        VALOR: dup.valor
            ? dup.valor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
            })
            : "R$ 0,00",
        DATA_EMISSAO: dup.dataEmissao || "---",
        DATA_VENCIMENTO: dup.dataVencimento || "---",
        DATA_PAGAMENTO: dup.dataPagamento || "---",
        DIAS_ATRASO: dup.diasAtraso || 0,
        STATUS: dup.statusPagamento || "---",
        VALOR_PAGO: dup.valorPag
            ? dup.valorPag.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
            })
            : "R$ 0,00",
    }));
};

export const formatValorExtenso = (valor) => {
    return formatValorExtensoAutomatico(valor);
};

export const formatNumeroExtenso = (numero) => {
    if (!numero || numero === 0) return "zero";

    try {
        return extenso(numero);
    } catch {
        return String(numero);
    }
};

export const formatNumeroExtensoFeminino = (numero) => {
    if (!numero || numero === 0) return "zero";

    try {
        const numeroExtenso = extenso(numero);

        // Conversão para feminino
        return numeroExtenso
            .replace(/\bum\b/g, "uma")
            .replace(/\bdois\b/g, "duas")
            .replace(/\bUm\b/g, "Uma")
            .replace(/\bDois\b/g, "Duas");
    } catch {
        return String(numero);
    }
};

export const gerarTextoParcelasWithOptionalEntrada = (
    temEntrada,
    numParcelas,
    numParcelasExtenso,
    valorEntrada,
    valorEntradaExtenso,
    valorParcela,
    valorParcelaExtenso
) => {
    if (temEntrada) {
        return `será pago em ${numParcelas} (${numParcelasExtenso}) parcelas, sendo uma entrada de R$ ${valorEntrada} (${valorEntradaExtenso}) e as demais parcelas de ${valorParcela} (${valorParcelaExtenso}), conforme tabela abaixo:`;
    } else {
        return `será pago em ${numParcelas} (${numParcelasExtenso}) parcelas de ${valorParcela} (${valorParcelaExtenso}), conforme tabela abaixo:`;
    }
};