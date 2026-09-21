import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import "./SituacaoFinanceira.css";
import { exportToCSV, exportToXLSX, exportToXLS, exportToPDF } from "../../utils/exportUtils.js";
import EmptyState from "../common/EmptyState.jsx";
import SectionCollapseButton from "../common/SectionCollapseButton.jsx";
import {
    LuCheck as Check,
    LuClock as Clock,
    LuDollarSign as DollarSign,
    LuTriangleAlert as AlertTriangle,
    LuCircleStop as StopCircle,
    LuCircleX as XCircle,
    LuArrowUpDown as ArrowUpDown,
    LuArrowUp as ArrowUp,
    LuArrowDown as ArrowDown,
    LuChevronDown as ChevronDown,
    LuDownload as Download,
    LuSearchX as SearchX,
    LuCircleDot as CircleDot,
    LuUndo2 as Undo2,
} from "react-icons/lu";

function formatCurrency(value) {
    if (isNaN(value) || value === null || value === undefined) {
        return "---";
    }
    if (value === 0) {
        return "---";
    }

    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function formatDataBruta(dateStr) {
    if (!dateStr) return "---";
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

// status 1 = Normal; qualquer outro (2 = Devolvido, 3 = Cancelado, 4 = Quebrada)
// prevalece sobre o status de pagamento calculado.
const STATUS_ESPECIAL_LABEL = {
    2: "Devolvido",
    3: "Cancelado",
    4: "Quebrada",
};

function statusEspecial(status) {
    return STATUS_ESPECIAL_LABEL[status] || null;
}

const DOCUMENT_TYPE_LABEL = {
    1: "Fatura",
    2: "Cheque",
    3: "Dinheiro",
    4: "Cartão de Crédito",
    5: "Cartão de Débito",
    6: "Nota de Débito",
    10: "Adiantamento",
};

// Tipo desconhecido não é erro — a API pode trazer códigos novos que ainda não
// mapeamos, então mostramos o número cru pra não esconder a informação do usuário.
function traduzirTipoDocumento(documentType) {
    if (documentType === null || documentType === undefined) return "---";
    return DOCUMENT_TYPE_LABEL[documentType] || String(documentType);
}

// Compara em centavos (arredondado) pra não cair em erro de ponto flutuante
// — ex: 290.60 - 35.23 pode virar 255.36999999999998 em JS e marcar como
// "Pago Parcialmente" uma parcela que na verdade já foi liquidada certinho.
function ehPagoParcialmente(item) {
    const valorLiquidado = (item.paidValue || 0) + (item.discountValue || 0);
    const centavosLiquidado = Math.round(valorLiquidado * 100);
    const centavosParcela = Math.round((item.installmentValue || 0) * 100);
    return centavosLiquidado < centavosParcela;
}

function getStatusItemBruto(item) {
    const especial = statusEspecial(item.status);
    if (especial) return especial;

    if (item.paymentDate) {
        if (ehPagoParcialmente(item)) return "Pago Parcialmente";

        const pago = new Date(item.paymentDate);
        pago.setHours(0, 0, 0, 0);

        const vencimento = new Date(item.expiredDate);
        vencimento.setHours(0, 0, 0, 0);

        return pago > vencimento ? "Pago com Atraso" : "Pago";
    }

    if (!item.expiredDate) return "A Vencer";

    const vencimento = new Date(item.expiredDate);
    vencimento.setHours(0, 0, 0, 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (vencimento.getTime() === hoje.getTime()) return "Vence Hoje";
    return vencimento < hoje ? "Vencido" : "A Vencer";
}

function diasAtrasoBruto(item) {
    const base = item.paymentDate ? new Date(item.paymentDate) : new Date();
    base.setHours(0, 0, 0, 0);

    const vencimento = new Date(item.expiredDate);
    vencimento.setHours(0, 0, 0, 0);

    return Math.max(Math.floor((base - vencimento) / 86400000), 0);
}

function normalizarDetalheParcela(dup) {
    return {
        id: dup.id,
        clienteCodigo: null,
        clienteDoc: "",
        parcela: dup.parcela,
        valor: dup.valor,
        valorDesc: dup.valorDesc,
        valorPag: dup.valorPag,
        dataEmissao: dup.dataEmissao,
        dataVencimento: dup.dataVencimento,
        dataPagamento: dup.dataPagamento,
        diasAtraso: dup.diasAtraso,
        statusPagamento: dup.statusPagamento,
        conta: dup.conta,
        tipoDocumento: traduzirTipoDocumento(dup.documentType),
    };
}

function normalizarDetalheVinculo(item, chave, index) {
    return {
        id: `${chave}-${item.installmentCode ?? index}-${item.customerCode ?? ""}`,
        clienteCodigo: item.customerCode ?? null,
        clienteDoc: item.customerCpfCnpj || "",
        parcela: item.installmentCode ?? null,
        valor: item.installmentValue || 0,
        valorDesc: item.discountValue || 0,
        valorPag: item.paidValue || 0,
        dataEmissao: formatDataBruta(item.issueDate),
        dataVencimento: formatDataBruta(item.expiredDate),
        dataPagamento: item.paymentDate ? formatDataBruta(item.paymentDate) : null,
        diasAtraso: statusEspecial(item.status) ? 0 : diasAtrasoBruto(item),
        statusPagamento: getStatusItemBruto(item),
        conta: item.bearerName || "",
        tipoDocumento: traduzirTipoDocumento(item.documentType),
    };
}

// Do mais grave pro mais tranquilo — a linha-resumo da fatura assume o pior
// status entre suas parcelas/vínculos, nunca escondendo algo vencido atrás
// de uma parcela nossa que esteja em dia. Devolvido/Cancelado/Quebrada vêm
// primeiro: é o status que a API retorna pro título e sempre prevalece sobre
// o status de pagamento calculado.
const STATUS_ESPECIAIS = ["Devolvido", "Cancelado", "Quebrada"];
const PRIORIDADE_STATUS = [...STATUS_ESPECIAIS, "Vencido", "Vence Hoje", "A Vencer", "Pago Parcialmente", "Pago com Atraso", "Baixado com Atraso", "Pago", "Baixado"];

// Cobranças que já tiveram algum pagamento lançado — usado pra somar o
// "Valor Cobrado" da fatura (quanto do Valor Total já foi efetivamente cobrado).
const STATUS_COBRADOS = ["Pago", "Pago com Atraso", "Pago Parcialmente", "Baixado", "Baixado com Atraso"];

// Quando a cobrança é de OUTRO cliente (não o que estamos pesquisando), "Pago"/
// "Pago com Atraso" não fazem sentido do ponto de vista desse cliente — quem
// pagou foi o outro. Vira "Baixado"/"Baixado com Atraso": a fatura foi
// liquidada, só que por outro vínculo. "Pago Parcialmente" não entra aqui
// porque ainda tem saldo em aberto.
const STATUS_BAIXADO_SE_OUTRO_CLIENTE = {
    "Pago": "Baixado",
    "Pago com Atraso": "Baixado com Atraso",
};

// A tabela mostra uma linha por FATURA, não por parcela — a validação da
// filial 6 já retorna todos os vínculos/parcelas daquela fatura+data numa
// busca só, então usamos ela como detalhe quando existir; pras demais
// filiais, o detalhe são as próprias parcelas que vieram da busca principal.
function agruparPorFatura(duplicatas) {
    const grupos = new Map();

    duplicatas.forEach((dup) => {
        const chave = `${dup.filial}-${dup.fatura}`;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(dup);
    });

    return Array.from(grupos.entries()).map(([chave, docsDaFatura]) => {
        const dupReferencia = docsDaFatura[0];

        // Entre as cobranças da mesma fatura compartilhada (filial 6), a do
        // próprio cliente que estamos pesquisando aparece primeiro na lista.
        const ehVinculoDoClientePesquisado = (item) => {
            if (dupReferencia.customerCode != null && item.clienteCodigo != null) {
                return item.clienteCodigo === dupReferencia.customerCode;
            }
            return Boolean(dupReferencia.customerCpfCnpj) && item.clienteDoc === dupReferencia.customerCpfCnpj;
        };

        // Cobrança de outro cliente que já foi paga não é "Pago" do ponto de
        // vista de quem estamos pesquisando — vira "Baixado"/"Baixado com Atraso".
        const aplicarBaixaSeOutroCliente = (item) => {
            if (ehVinculoDoClientePesquisado(item)) return item;
            const statusBaixado = STATUS_BAIXADO_SE_OUTRO_CLIENTE[item.statusPagamento];
            if (!statusBaixado) return item;
            return { ...item, statusPagamento: statusBaixado };
        };

        const ehFilial6ComVinculos = dupReferencia.validacaoFilial6?.items?.length > 0;

        const detalhes = ehFilial6ComVinculos
            ? dupReferencia.validacaoFilial6.items
                .map((item, index) => normalizarDetalheVinculo(item, chave, index))
                .map(aplicarBaixaSeOutroCliente)
                .sort((a, b) => Number(ehVinculoDoClientePesquisado(b)) - Number(ehVinculoDoClientePesquisado(a)))
            : docsDaFatura.map(normalizarDetalheParcela);

        // Numa fatura compartilhada (filial 6) a linha de resumo representa o
        // risco dos OUTROS clientes vinculados a ela — a cobrança do próprio
        // cliente pesquisado não entra nas somas/status do resumo, só aparece
        // no detalhe expandido. Sem nenhum vínculo de outro cliente, cai de
        // volta pra somar todas as cobranças (não tem "outro" pra representar).
        const outrosVinculos = ehFilial6ComVinculos
            ? detalhes.filter((item) => !ehVinculoDoClientePesquisado(item))
            : [];
        const detalhesResumo = outrosVinculos.length > 0 ? outrosVinculos : detalhes;

        const statusPorItem = detalhesResumo.map((item) => item.statusPagamento);
        const statusMaisGrave = PRIORIDADE_STATUS.find((status) => statusPorItem.includes(status)) || "-";
        const indiceReferencia = statusPorItem.indexOf(statusMaisGrave);
        const itemReferencia = detalhesResumo[indiceReferencia >= 0 ? indiceReferencia : 0] || dupReferencia;

        // Uma cobrança já quitada ao lado de outra ainda em aberto não é nem
        // "Vencido" nem "Pago" — a fatura como um todo ainda tem saldo pendente,
        // então isso vale mais que só apontar o status da pior cobrança.
        const statusPagos = ["Pago", "Pago com Atraso", "Baixado", "Baixado com Atraso"];
        const temPago = statusPorItem.some((status) => statusPagos.includes(status));
        const temEmAberto = statusPorItem.some((status) => !statusPagos.includes(status));
        const statusResumo = STATUS_ESPECIAIS.includes(statusMaisGrave)
            ? statusMaisGrave
            : (temPago && temEmAberto ? "Em Aberto" : statusMaisGrave);

        const valorTotal = detalhesResumo.reduce((soma, item) => soma + (item.valor || 0), 0);
        const valorCobradoTotal = detalhesResumo
            .filter((item) => STATUS_COBRADOS.includes(item.statusPagamento))
            .reduce((soma, item) => soma + (item.valor || 0), 0);
        const valorDescTotal = detalhesResumo.reduce((soma, item) => soma + (item.valorDesc || 0), 0);
        const valorPagTotal = detalhesResumo.reduce((soma, item) => soma + (item.valorPag || 0), 0);
        const diasAtrasoResumo = Math.max(0, ...detalhesResumo.map((item) => item.diasAtraso || 0));

        return {
            id: chave,
            duplicata: dupReferencia.duplicata,
            fatura: dupReferencia.fatura,
            filial: dupReferencia.filial,
            qtdCobrancas: detalhes.length,
            valor: valorTotal,
            valorCobrado: valorCobradoTotal,
            valorDesc: valorDescTotal,
            valorPag: valorPagTotal,
            dataEmissao: itemReferencia.dataEmissao,
            dataVencimento: itemReferencia.dataVencimento,
            dataPagamento: itemReferencia.dataPagamento,
            diasAtraso: diasAtrasoResumo,
            statusPagamento: statusResumo,
            conta: itemReferencia.conta,
            tipoDocumento: itemReferencia.tipoDocumento,
            detalhes,
        };
    });
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes("/")) {
        const [day, month, year] = dateStr.split("/");
        return new Date(year, month - 1, day).getTime();
    } else {
        return new Date(dateStr).getTime();
    }
}

function getStatusClass(status) {
    switch (status) {
        case "Pago":
            return "status-pago";
        case "A Vencer":
            return "status-a-vencer";
        case "Vencido":
            return "status-vencido";
        case "Pago com Atraso":
            return "status-pago-atraso";
        case "Pago Parcialmente":
            return "status-pago-parcial";
        case "Vence Hoje":
            return "status-vence-hoje";
        case "Em Aberto":
            return "status-em-aberto";
        case "Devolvido":
            return "status-devolvido";
        case "Cancelado":
            return "status-cancelado";
        case "Quebrada":
            return "status-quebrada";
        case "Baixado":
            return "status-pago";
        case "Baixado com Atraso":
            return "status-pago-atraso";
        default:
            return "";
    }
}

function getStatusIcon(status) {
    switch (status) {
        case "Pago":
            return (
                <Check size={16} />
            );
        case "A Vencer":
            return (
                <Clock size={16} />
            );
        case "Vencido":
            return (
                <XCircle size={16} />
            );
        case "Pago com Atraso":
            return (
                <AlertTriangle size={16} />
            );
        case "Pago Parcialmente":
            return (
                <StopCircle size={16} />
            );
        case "Vence Hoje":
            return (
                <Clock size={16} />
            );
        case "Em Aberto":
            return (
                <CircleDot size={16} />
            );
        case "Devolvido":
            return (
                <Undo2 size={16} />
            );
        case "Cancelado":
            return (
                <XCircle size={16} />
            );
        case "Quebrada":
            return (
                <AlertTriangle size={16} />
            );
        case "Baixado":
            return (
                <Check size={16} />
            );
        case "Baixado com Atraso":
            return (
                <AlertTriangle size={16} />
            );
        default:
            return null;
    }
}

function SortIcon({ field, sortField, sortOrder }) {
    if (field !== sortField) {
        return <ArrowUpDown size={13} className="sort-icon" />;
    }
    return sortOrder === "asc"
        ? <ArrowUp size={13} className="sort-icon sort-icon-active" />
        : <ArrowDown size={13} className="sort-icon sort-icon-active" />;
}

function SituacaoFinanceira({ duplicatas, mostrarFilial = false }) {
    const [colapsado, setColapsado] = useState(false);
    const [sort, setSort] = useState({ field: "dataVencimento", order: "asc" });
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [statusPendente, setStatusPendente] = useState([]);
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [linhasExpandidas, setLinhasExpandidas] = useState(new Set());

    const toggleExpandirLinha = (id) => {
        setLinhasExpandidas((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const agrupadas = useMemo(() => agruparPorFatura(duplicatas), [duplicatas]);

    const allStatuses = useMemo(() => {
        const statuses = new Set(agrupadas.map(d => d.statusPagamento));
        return Array.from(statuses).sort();
    }, [agrupadas]);

    const filterContainerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterContainerRef.current && !filterContainerRef.current.contains(event.target)) {
                setIsStatusFilterOpen(false);
                setIsExportOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // O filtro só é aplicado de fato quando o usuário clica "Aplicar" — marcar
    // um checkbox não reduz a tabela na hora, evita aquele "pulo" de tela a
    // cada clique enquanto ainda tá combinando vários status.
    const handleStatusPendenteChange = (status) => {
        setStatusPendente(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const handleStatusFilterToggle = () => {
        const abrindo = !isStatusFilterOpen;
        if (abrindo) setStatusPendente(selectedStatuses);
        setIsStatusFilterOpen(abrindo);
        setIsExportOpen(false);
    };

    const handleStatusApply = () => {
        setSelectedStatuses(statusPendente);
        setIsStatusFilterOpen(false);
    };

    const handleStatusReset = () => {
        setStatusPendente([]);
        setSelectedStatuses([]);
    };

    const handleExportToggle = () => {
        setIsExportOpen(!isExportOpen);
        setIsStatusFilterOpen(false);
    };

    const filtered = useMemo(() => {
        let result = [...agrupadas];

        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase();
            result = result.filter(d =>
                d.duplicata.toLowerCase().includes(search) ||
                d.fatura.toLowerCase().includes(search)
            );
        }

        if (selectedStatuses.length > 0) {
            result = result.filter(d => selectedStatuses.includes(d.statusPagamento));
        }

        return result;
    }, [agrupadas, searchTerm, selectedStatuses]);

    const sorted = useMemo(() => {
        let result = [...filtered];

        result.sort((a, b) => {
            let aVal, bVal;

            switch (sort.field) {
                case "diasAtraso":
                    aVal = a.diasAtraso;
                    bVal = b.diasAtraso;
                    break;
                case "valor":
                    aVal = a.valor;
                    bVal = b.valor;
                    break;
                case "valorCobrado":
                    aVal = a.valorCobrado;
                    bVal = b.valorCobrado;
                    break;
                case "valorPag":
                    aVal = a.valorPag;
                    bVal = b.valorPag;
                    break;
                case "dataEmissao":
                    aVal = parseDate(a.dataEmissao) || 0;
                    bVal = parseDate(b.dataEmissao) || 0;
                    break;
                case "dataVencimento":
                    aVal = parseDate(a.dataVencimento) || 0;
                    bVal = parseDate(b.dataVencimento) || 0;
                    break;
                case "dataPagamento":
                    aVal = parseDate(a.dataPagamento) || Infinity;
                    bVal = parseDate(b.dataPagamento) || Infinity;
                    break;
                case "statusPagamento":
                    aVal = a.statusPagamento;
                    bVal = b.statusPagamento;
                    break;
                case "conta":
                    aVal = a.conta;
                    bVal = b.conta;
                    break;
                case "filial":
                    aVal = a.filial;
                    bVal = b.filial;
                    break;
                case "duplicata":
                    aVal = a.duplicata;
                    bVal = b.duplicata;
                    break;
                case "fatura":
                    aVal = a.fatura;
                    bVal = b.fatura;
                    break;
                case "tipoDocumento":
                    aVal = a.tipoDocumento;
                    bVal = b.tipoDocumento;
                    break;
                case "qtdCobrancas":
                    aVal = a.qtdCobrancas;
                    bVal = b.qtdCobrancas;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) {
                return sort.order === "asc" ? -1 : 1;
            }
            if (aVal > bVal) {
                return sort.order === "asc" ? 1 : -1;
            }
            return 0;
        });

        return result;
    }, [filtered, sort]);

    const handleSortClick = (field) => {
        if (sort.field === field) {
            setSort({ field, order: sort.order === "asc" ? "desc" : "asc" });
        } else {
            setSort({ field, order: "asc" });
        }
    };

    const handleExport = async (format) => {
        const dataToExport = sorted.map(item => ({
            ...(mostrarFilial && { filial: item.filial }),
            duplicata: item.duplicata,
            fatura: item.fatura,
            tipoDocumento: item.tipoDocumento,
            qtdCobrancas: item.qtdCobrancas,
            valor: formatCurrency(item.valor),
            valorCobrado: formatCurrency(item.valorCobrado),
            valorPag: formatCurrency(item.valorPag),
            dataEmissao: item.dataEmissao,
            dataVencimento: item.dataVencimento,
            dataPagamento: item.dataPagamento,
            diasAtraso: item.diasAtraso,
            statusPagamento: item.statusPagamento,
            conta: item.conta
        }));

        const timestamp = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const filename = `duplicatas_${timestamp}`;

        switch (format) {
            case 'csv':
                exportToCSV(dataToExport, `${filename}.csv`, mostrarFilial);
                break;
            case 'xlsx':
                exportToXLSX(dataToExport, `${filename}.xlsx`, mostrarFilial);
                break;
            case 'xls':
                exportToXLS(dataToExport, `${filename}.xls`, mostrarFilial);
                break;
            case 'pdf':
                await exportToPDF(dataToExport, `${filename}.pdf`, mostrarFilial);
                break;
            default:
                break;
        }

        setIsExportOpen(false);
        setIsStatusFilterOpen(false);
    };

    return (
        <section className="financeira-section">
            <div className="section-header">
                <div className="section-title-group">
                    <DollarSign size={20} />
                    <h2>Situação Financeira</h2>
                </div>
                <div className="section-header-actions">
                    <span className="record-count">{sorted.length} registros</span>
                    <SectionCollapseButton
                        colapsado={colapsado}
                        onClick={() => setColapsado((v) => !v)}
                        label="Situação Financeira"
                    />
                </div>
            </div>

            {!colapsado && (
                <>
                    <div className="table-filters" ref={filterContainerRef}>
                        <input
                            type="text"
                            placeholder="Buscar Fatura..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="filter-search"
                        />

                        <div className="filter-status-container">
                            <button
                                className="filter-status-button"
                                onClick={handleStatusFilterToggle}
                            >
                                <span>Status {selectedStatuses.length > 0 ? `(${selectedStatuses.length})` : "(Todos)"}</span>
                                <ChevronDown size={14} className={`filter-chevron ${isStatusFilterOpen ? "is-open" : ""}`} />
                            </button>
                            {isStatusFilterOpen && (
                                <div className="filter-status-dropdown">
                                    <div className="filter-status-options">
                                        {allStatuses.map(status => (
                                            <label key={status} className="status-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={statusPendente.includes(status)}
                                                    onChange={() => handleStatusPendenteChange(status)}
                                                />
                                                <span>{status}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="filter-status-actions">
                                        <button
                                            type="button"
                                            className="filter-status-reset"
                                            onClick={handleStatusReset}
                                        >
                                            Redefinir
                                        </button>
                                        <button
                                            type="button"
                                            className="filter-status-apply"
                                            onClick={handleStatusApply}
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="filter-export-container">
                            <button
                                className="filter-export-button"
                                onClick={handleExportToggle}
                            >
                                <Download size={15} />
                                <span>Exportar</span>
                                <ChevronDown size={14} className={`filter-chevron ${isExportOpen ? "is-open" : ""}`} />
                            </button>
                            {isExportOpen && (
                                <div className="filter-export-dropdown">
                                    <button
                                        className="export-option"
                                        onClick={() => handleExport('csv')}
                                    >
                                        CSV
                                    </button>
                                    <button
                                        className="export-option"
                                        onClick={() => handleExport('xlsx')}
                                    >
                                        XLSX
                                    </button>
                                    <button
                                        className="export-option"
                                        onClick={() => handleExport('xls')}
                                    >
                                        XLS
                                    </button>
                                    <button
                                        className="export-option"
                                        onClick={() => handleExport('pdf')}
                                    >
                                        PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="table-card">

                        <div className="table-wrapper">
                            <table className="financeira-table">
                                <thead>
                                    <tr>
                                        <th className="col-expand"></th>
                                        {mostrarFilial && (
                                            <th className="sortable" onClick={() => handleSortClick("filial")}>
                                                Filial <SortIcon field="filial" sortField={sort.field} sortOrder={sort.order} />
                                            </th>
                                        )}
                                        <th className="col-center sortable" onClick={() => handleSortClick("fatura")}>
                                            Fatura <SortIcon field="fatura" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("tipoDocumento")}>
                                            Tipo <SortIcon field="tipoDocumento" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("qtdCobrancas")}>
                                            Cobranças <SortIcon field="qtdCobrancas" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("valor")}>
                                            Valor Total <SortIcon field="valor" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("valorCobrado")}>
                                            Valor Cobrado <SortIcon field="valorCobrado" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("valorDesc")}>
                                            Valor Desconto <SortIcon field="valorDesc" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("valorPag")}>
                                            Valor Pago <SortIcon field="valorPag" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("dataEmissao")}>
                                            Emissão <SortIcon field="dataEmissao" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("dataVencimento")}>
                                            Vencimento <SortIcon field="dataVencimento" sortField={sort.field}
                                                sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("dataPagamento")}>
                                            Pagamento <SortIcon field="dataPagamento" sortField={sort.field}
                                                sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("diasAtraso")}>
                                            Dias Atraso <SortIcon field="diasAtraso" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="col-center sortable" onClick={() => handleSortClick("statusPagamento")}>
                                            Status <SortIcon field="statusPagamento" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                        <th className="sortable" onClick={() => handleSortClick("conta")}>
                                            Conta <SortIcon field="conta" sortField={sort.field} sortOrder={sort.order} />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((dup) => {
                                        const podeExpandir = dup.detalhes.length > 0;
                                        const expandida = linhasExpandidas.has(dup.id);
                                        const totalColunas = 13 + (mostrarFilial ? 1 : 0) + 1;

                                        return (
                                            <Fragment key={dup.id}>
                                                <tr className={dup.statusPagamento === "Vencido" ? "row-vencido" : ""}>
                                                    <td className="col-expand">
                                                        {podeExpandir && (
                                                            <button
                                                                type="button"
                                                                className="row-expand-button"
                                                                onClick={() => toggleExpandirLinha(dup.id)}
                                                                aria-label={`Ver cobranças da fatura ${dup.fatura}`}
                                                            >
                                                                <ChevronDown
                                                                    size={15}
                                                                    className={`row-expand-icon ${expandida ? "is-open" : ""}`}
                                                                />
                                                            </button>
                                                        )}
                                                    </td>
                                                    {mostrarFilial && (
                                                        <td className="col-filial">{dup.filial}</td>
                                                    )}
                                                    <td className="col-center col-fatura">
                                                        <code>{dup.fatura}</code>
                                                    </td>
                                                    <td className="col-center">{dup.tipoDocumento}</td>
                                                    <td className="col-center">{dup.qtdCobrancas}</td>
                                                    <td className="col-center col-valor">{formatCurrency(dup.valor)}</td>
                                                    <td className="col-center col-valor">{formatCurrency(dup.valorCobrado)}</td>
                                                    <td className="col-center col-valor">{formatCurrency(dup.valorDesc)}</td>
                                                    <td className="col-center col-valor">{formatCurrency(dup.valorPag)}</td>
                                                    <td className="col-center">{dup.dataEmissao}</td>
                                                    <td className="col-center">{dup.dataVencimento}</td>
                                                    <td className="col-center">{dup.dataPagamento || "---"}</td>
                                                    <td className="col-center">
                                                        {dup.diasAtraso > 0 ? (
                                                            <span className="dias-atraso">{dup.diasAtraso}d</span>
                                                        ) : (
                                                            <span className="dias-ok">-</span>
                                                        )}
                                                    </td>
                                                    <td className="col-center">
                                                        <span className={`table-status ${getStatusClass(dup.statusPagamento)}`}>
                                                            {getStatusIcon(dup.statusPagamento)}
                                                            {dup.statusPagamento}
                                                        </span>
                                                    </td>
                                                    <td className="col-conta">{dup.conta}</td>
                                                </tr>
                                                {expandida && (
                                                    <tr className="row-expand-detail">
                                                        <td colSpan={totalColunas}>
                                                            <div className="row-expand-content">
                                                                <span className="row-expand-title">
                                                                    Cobranças da fatura {dup.fatura} · {dup.qtdCobrancas} {dup.qtdCobrancas === 1 ? "cobrança" : "cobranças"}
                                                                </span>
                                                                <div className="row-expand-cards">
                                                                    {dup.detalhes.map((item) => (
                                                                        <div key={item.id} className="validacao-card">
                                                                            <div className="validacao-card-header">
                                                                                <div className="validacao-card-cliente">
                                                                                    <span className="validacao-card-cliente-codigo">
                                                                                        {item.clienteCodigo
                                                                                            ? `Cliente ${item.clienteCodigo}`
                                                                                            : `Parcela ${item.parcela ?? "-"}`}
                                                                                    </span>
                                                                                    {item.clienteDoc && (
                                                                                        <span className="validacao-card-cliente-doc">
                                                                                            {item.clienteDoc}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="validacao-card-grid">
                                                                                {item.clienteCodigo && (
                                                                                    <div className="validacao-stat">
                                                                                        <span className="validacao-stat-label">Parcela</span>
                                                                                        <span className="validacao-stat-value">{item.parcela ?? "-"}</span>
                                                                                    </div>
                                                                                )}
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Tipo</span>
                                                                                    <span className="validacao-stat-value">{item.tipoDocumento}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Valor Parcela</span>
                                                                                    <span className="validacao-stat-value">{formatCurrency(item.valor)}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Valor Desconto</span>
                                                                                    <span className="validacao-stat-value">{formatCurrency(item.valorDesc)}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Valor Pago</span>
                                                                                    <span className="validacao-stat-value">{formatCurrency(item.valorPag)}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Emissão</span>
                                                                                    <span className="validacao-stat-value">{item.dataEmissao || "---"}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Vencimento</span>
                                                                                    <span className="validacao-stat-value">{item.dataVencimento || "---"}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Pagamento</span>
                                                                                    <span className="validacao-stat-value">{item.dataPagamento || "---"}</span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Status</span>
                                                                                    <span className={`table-status ${getStatusClass(item.statusPagamento)}`}>
                                                                                        {getStatusIcon(item.statusPagamento)}
                                                                                        {item.statusPagamento}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="validacao-stat">
                                                                                    <span className="validacao-stat-label">Conta</span>
                                                                                    <span className="validacao-stat-value">{item.conta || "---"}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {sorted.length === 0 && (
                            duplicatas.length === 0 ? (
                                <EmptyState
                                    icon={DollarSign}
                                    title="Nenhuma duplicata encontrada"
                                    subtitle="Esse cliente não possui duplicatas para o período consultado."
                                />
                            ) : (
                                <EmptyState
                                    icon={SearchX}
                                    title="Nenhum registro encontrado"
                                    subtitle="Ajuste a busca ou os filtros de status para ver outros resultados."
                                />
                            )
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

export default SituacaoFinanceira;