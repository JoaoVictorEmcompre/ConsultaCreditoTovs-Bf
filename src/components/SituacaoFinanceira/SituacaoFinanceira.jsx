import {useState, useMemo, useEffect, useRef} from "react";
import "./SituacaoFinanceira.css";
import {exportToCSV, exportToXLSX, exportToXLS, exportToPDF} from "../../utils/exportUtils.js";
import {
    Check,
    Clock,
    DollarSign,
    AlertTriangle,
    StopCircle,
    XCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronDown,
    Download,
} from "lucide-react";

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
        default:
            return "";
    }
}

function getStatusIcon(status) {
    switch (status) {
        case "Pago":
            return (
                <Check size={16}/>
            );
        case "A Vencer":
            return (
                <Clock size={16}/>
            );
        case "Vencido":
            return (
                <XCircle size={16}/>
            );
        case "Pago com Atraso":
            return (
                <AlertTriangle size={16}/>
            );
        case "Pago Parcialmente":
            return (
                <StopCircle size={16}/>
            );
        case "Vence Hoje":
            return (
                <Clock size={16}/>
            );
        default:
            return null;
    }
}

function SortIcon({field, sortField, sortOrder}) {
    if (field !== sortField) {
        return <ArrowUpDown size={13} className="sort-icon"/>;
    }
    return sortOrder === "asc"
        ? <ArrowUp size={13} className="sort-icon sort-icon-active"/>
        : <ArrowDown size={13} className="sort-icon sort-icon-active"/>;
}

function SituacaoFinanceira({duplicatas, mostrarFilial = false}) {
    const [sort, setSort] = useState({field: "dataVencimento", order: "asc"});
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    const allStatuses = useMemo(() => {
        const statuses = new Set(duplicatas.map(d => d.statusPagamento));
        return Array.from(statuses).sort();
    }, [duplicatas]);

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

    const handleStatusChange = (status) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const handleStatusFilterToggle = () => {
        setIsStatusFilterOpen(!isStatusFilterOpen);
        setIsExportOpen(false);
    };

    const handleExportToggle = () => {
        setIsExportOpen(!isExportOpen);
        setIsStatusFilterOpen(false);
    };

    const filtered = useMemo(() => {
        let result = [...duplicatas];

        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase();
            result = result.filter(d =>
                d.duplicata.toLowerCase().includes(search) ||
                d.parcela.toLowerCase().includes(search)
            );
        }

        if (selectedStatuses.length > 0) {
            result = result.filter(d => selectedStatuses.includes(d.statusPagamento));
        }

        return result;
    }, [duplicatas, searchTerm, selectedStatuses]);

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
                case "parcela":
                    aVal = a.parcela;
                    bVal = b.parcela;
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
            setSort({field, order: sort.order === "asc" ? "desc" : "asc"});
        } else {
            setSort({field, order: "asc"});
        }
    };

    const handleExport = async (format) => {
        const dataToExport = sorted.map(item => ({
            ...(mostrarFilial && {filial: item.filial}),
            duplicata: item.duplicata,
            parcela: item.parcela,
            valor: formatCurrency(item.valor),
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
                    <DollarSign size={20}/>
                    <h2>Situação Financeira</h2>
                </div>
                <span className="record-count">{sorted.length} registros</span>
            </div>

            <div className="table-filters" ref={filterContainerRef}>
                <input
                    type="text"
                    placeholder="Buscar Duplicata..."
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
                        <ChevronDown size={14} className={`filter-chevron ${isStatusFilterOpen ? "is-open" : ""}`}/>
                    </button>
                    {isStatusFilterOpen && (
                        <div className="filter-status-dropdown">
                            {allStatuses.map(status => (
                                <label key={status} className="status-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedStatuses.includes(status)}
                                        onChange={() => handleStatusChange(status)}
                                    />
                                    <span>{status}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="filter-export-container">
                    <button
                        className="filter-export-button"
                        onClick={handleExportToggle}
                    >
                        <Download size={15}/>
                        <span>Exportar</span>
                        <ChevronDown size={14} className={`filter-chevron ${isExportOpen ? "is-open" : ""}`}/>
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
                            {mostrarFilial && (
                                <th className="sortable" onClick={() => handleSortClick("filial")}>
                                    Filial <SortIcon field="filial" sortField={sort.field} sortOrder={sort.order}/>
                                </th>
                            )}
                            <th className="sortable" onClick={() => handleSortClick("duplicata")}>
                                Duplicata <SortIcon field="duplicata" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="sortable" onClick={() => handleSortClick("parcela")}>
                                Parcela <SortIcon field="parcela" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="col-right sortable" onClick={() => handleSortClick("valor")}>
                                Valor Parcela <SortIcon field="valor" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="col-right sortable" onClick={() => handleSortClick("valorPag")}>
                                Valor Pago <SortIcon field="valorPag" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="sortable" onClick={() => handleSortClick("dataEmissao")}>
                                Emissão <SortIcon field="dataEmissao" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="sortable" onClick={() => handleSortClick("dataVencimento")}>
                                Vencimento <SortIcon field="dataVencimento" sortField={sort.field}
                                                     sortOrder={sort.order}/>
                            </th>
                            <th className="sortable" onClick={() => handleSortClick("dataPagamento")}>
                                Pagamento <SortIcon field="dataPagamento" sortField={sort.field}
                                                    sortOrder={sort.order}/>
                            </th>
                            <th className="col-center sortable" onClick={() => handleSortClick("diasAtraso")}>
                                Dias Atraso <SortIcon field="diasAtraso" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="sortable" onClick={() => handleSortClick("statusPagamento")}>
                                Status <SortIcon field="statusPagamento" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                            <th className="sortable" onClick={() => handleSortClick("conta")}>
                                Conta <SortIcon field="conta" sortField={sort.field} sortOrder={sort.order}/>
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {sorted.map((dup) => (
                            <tr key={dup.id} className={dup.statusPagamento === "Vencido" ? "row-vencido" : ""}>
                                {mostrarFilial && (
                                    <td className="col-filial">{dup.filial}</td>
                                )}
                                <td className="col-duplicata">
                                    <code>{dup.duplicata}</code>
                                </td>
                                <td>{dup.parcela}</td>
                                <td className="col-center col-valor">{formatCurrency(dup.valor)}</td>
                                <td className="col-center col-valor">{formatCurrency(dup.valorPag)}</td>
                                <td>{dup.dataEmissao}</td>
                                <td>{dup.dataVencimento}</td>
                                <td>{dup.dataPagamento || "---"}</td>
                                <td className="col-center">
                                    {dup.diasAtraso > 0 ? (
                                        <span className="dias-atraso">{dup.diasAtraso}d</span>
                                    ) : (
                                        <span className="dias-ok">-</span>
                                    )}
                                </td>
                                <td>
                                        <span className={`table-status ${getStatusClass(dup.statusPagamento)}`}>
                                            {getStatusIcon(dup.statusPagamento)}
                                            {dup.statusPagamento}
                                        </span>
                                </td>
                                <td className="col-conta">{dup.conta}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {sorted.length === 0 && (
                    <div className="empty-state">
                        <p>Nenhum registro encontrado com os filtros aplicados.</p>
                    </div>
                )}
            </div>
        </section>
    );
}

export default SituacaoFinanceira;