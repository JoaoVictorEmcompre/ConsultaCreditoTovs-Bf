const API_BASE = import.meta.env.VITE_API_URL;

async function fetchJson(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {"Accept": "application/json"},
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        err.body = text;
        throw err;
    }
    return res.json();
}

export async function getCliente(codCliente) {
    return fetchJson(`/clientes/${encodeURIComponent(codCliente)}`);
}

export async function getTitulosFuturos(codCliente) {
    return fetchJson(`/clientes/${encodeURIComponent(codCliente)}/titulos/futuros`);
}

export async function getTitulosVencidos(codCliente) {
    return fetchJson(`/clientes/${encodeURIComponent(codCliente)}/titulos/vencidos`);
}

export function mapClienteToDadosCadastrais(api) {
    const trim = (v) => (typeof v === "string" ? v.trim() : v ?? "");
    const situacao = api?.tpSituacao === "A" ? "Ativa" : "Inativa";
    const enderecoLinha = [trim(api?.dnEndereco), trim(api?.nrEndereco)].filter(Boolean).join(", ");
    const bairro = trim(api?.dnBairro);
    const endereco = [enderecoLinha, bairro].filter(Boolean).join(" - ");
    const cidade = trim(api?.dnMunicipio);
    const cep = trim(api?.cdCep);
    const dataAbertura = api?.dtClienteDesde ? new Date(api.dtClienteDesde).toLocaleDateString("pt-BR") : "---";
    return {
        razaoSocial: trim(api?.dnRazao) || "---",
        nomeFantasia: trim(api?.dnFantasia) || "---",
        cnpj: trim(api?.cdCgccpf) || "---",
        inscricaoEstadual: "---",
        endereco: endereco || "---",
        cidade: cidade || "---",
        estado: "",
        cep: cep || "---",
        telefoneFixo: trim(api?.cdFone) || "---",
        whatsapp: trim(api?.cdFone) || "---",
        email: trim(api?.cdEmail) || "---",
        divisaoNegocios: trim(api?.dnMercado) || "---",
        dataAbertura,
        situacao,
        limiteCreditoTotal: Number(api?.vlLimiteCred ?? 0),
        vlVencido: Number(api?.vlVencido ?? 0),
        vlVencer: Number(api?.vlVencer ?? 0),
        dataUltimaRevisao: api?.dtRevisao ? new Date(api.dtRevisao).toLocaleDateString("pt-BR") : "---",
    };
}

function parseDate(d) {
    if (!d) return null;
    const iso = new Date(d);
    if (!Number.isNaN(iso.getTime())) return iso;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    if (m) {
        const [_, dd, mm, yyyy] = m;
        return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    return null;
}

function diffDays(a, b) {
    const ms = a.getTime() - b.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function mapTituloToDuplicata(item, status) {
    const emissao = parseDate(item?.dataEmissao ?? item?.emissao);
    const venc =
        parseDate(item?.dataVencimento ?? item?.vencimento) ||
        parseDate(item?.dtVencimento);
    const pag =
        parseDate(item?.dataPagamento ?? item?.pagamento) ||
        parseDate(item?.dtUltPagto);
    const hoje = new Date();
    const diasAtraso =
        status === "Vencido"
            ? item?.diasAtraso ?? (venc ? Math.max(0, diffDays(hoje, venc)) : 0)
            : 0;
    return {
        id: item?.id ?? `${status}-${item?.nrNotaFiscal ?? item?.numero ?? Math.random()}`,
        duplicata: item?.nrNotaFiscal ?? item?.numero ?? item?.titulo ?? "TÍTULO",
        parcela: item?.parcela ?? item?.parcelaNumero ?? "1/1",
        valor: Number(item?.valorAberto ?? item?.vlTitulo ?? item?.valor ?? item?.valorTitulo ?? 0),
        dataEmissao: emissao ? emissao.toLocaleDateString("pt-BR") : "---",
        dataVencimento: venc ? venc.toLocaleDateString("pt-BR") : "---",
        dataPagamento: pag ? pag.toLocaleDateString("pt-BR") : null,
        diasAtraso,
        statusPagamento: status,
        conta: item?.conta ?? item?.banco ?? "---",
    };
}

export function calcularResumo(duplicatasVencidas, duplicatasFuturas, cliente) {
    const sum = (arr) => arr.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
    const parcelasVencidas = Number(cliente?.vlVencido ?? 0) || sum(duplicatasVencidas);
    const parcelasAVencer = Number(cliente?.vlVencer ?? 0) || sum(duplicatasFuturas);
    const limiteCreditoTotal = Number(cliente?.limiteCreditoTotal ?? cliente?.vlLimiteCred ?? 0);
    const limiteCreditoUtilizado = parcelasVencidas + parcelasAVencer;
    const limiteDisponivel = Math.max(0, limiteCreditoTotal - limiteCreditoUtilizado);
    return {
        limiteCreditoTotal,
        limiteCreditoUtilizado,
        parcelasVencidas,
        parcelasAVencer,
        limiteDisponivel,
        prazoMedioCarteira: 45,
        prazoMedioFat60d: 32,
        prazoMedioAtraso12m: 8,
        dataUltimaRevisao: cliente?.dataUltimaRevisao ?? cliente?.dtRevisao
            ? new Date(cliente.dtRevisao).toLocaleDateString("pt-BR")
            : "---",
        pedidosAEntregar: 0,
        totalPedidosAEntregar: 0,
    };
}
