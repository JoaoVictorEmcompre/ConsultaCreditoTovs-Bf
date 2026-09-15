import "./InformacoesComplementares.css";
import { FileText, Wallet, ShoppingBag, Undo2, CreditCard, Receipt, Inbox } from "lucide-react";

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

function formatSaldo(value) {
    if (isNaN(value) || value === null || value === undefined) {
        return "---";
    }

    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

const SEFAZ_LABELS = {
    Authorized: "Autorizada",
    Denied: "Negada",
    Rejected: "Rejeitada",
    Canceled: "Cancelada",
    Cancelled: "Cancelada",
};

function traduzStatusSefaz(status) {
    if (!status || status === "-") return "-";
    return SEFAZ_LABELS[status] || status;
}

function pillClassSefaz(status) {
    if (status === "Autorizada") return "info-pill info-pill-ok";
    if (status === "-") return "info-pill info-pill-neutral";
    return "info-pill info-pill-atencao";
}

function pillClassBaixa(status) {
    if (status === "Baixa cartão com CREDEV") return "info-pill info-pill-ok";
    if (status === "Crédito parado") return "info-pill info-pill-atencao";
    if (status === "-") return "info-pill info-pill-neutral";
    return "info-pill info-pill-neutral";
}

function BlocoTabela({ icone, titulo, colunas, linhas, renderLinha }) {
    const Icone = icone;

    return (
        <div className="info-complementar-bloco">
            <div className="info-complementar-bloco-header">
                <div className="info-complementar-bloco-titulo">
                    <Icone size={16} />
                    <h3>{titulo}</h3>
                </div>
                <span className="info-complementar-contagem">{linhas.length}</span>
            </div>

            {linhas.length === 0 ? (
                <div className="info-complementar-vazio">
                    <Inbox size={22} />
                    <p>Nenhum registro encontrado</p>
                </div>
            ) : (
                <div className="info-complementar-tabela-wrapper">
                    <table className="info-complementar-tabela">
                        <thead>
                            <tr>
                                {colunas.map((coluna) => <th key={coluna}>{coluna}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map(renderLinha)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function InformacoesComplementares({ info }) {
    if (!info) return null;

    const { saldoCredev, notasVenda, notasDevolucao, titulosCredev, notasDebito } = info;

    return (
        <section className="info-complementar-section">
            <div className="section-header">
                <div className="section-title-group">
                    <FileText size={20} />
                    <h2>Informações Complementares</h2>
                </div>
            </div>

            <div className="info-complementar-saldo-card">
                <div className="info-complementar-saldo-icon">
                    <Wallet size={20} />
                </div>
                <div className="info-complementar-saldo-texto">
                    <span className="info-complementar-saldo-label">Saldo CREDEV</span>
                    <span className="info-complementar-saldo-valor">
                        {saldoCredev ? formatSaldo(saldoCredev.total) : "---"}
                    </span>
                </div>
                {saldoCredev?.porFilial?.length > 0 && (
                    <div className="info-complementar-saldo-filiais">
                        {saldoCredev.porFilial.map((item) => (
                            <span key={item.filial} className="info-complementar-saldo-filial">
                                <strong>{item.filial}</strong> {formatSaldo(item.saldo)}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="info-complementar-grid">
                <BlocoTabela
                    icone={ShoppingBag}
                    titulo="NF de Venda / Pedido"
                    colunas={["Pedido", "Pedido Marketplace", "Valor Total", "NF", "Representante", "Data"]}
                    linhas={notasVenda}
                    renderLinha={(item) => (
                        <tr key={item.id}>
                            <td><code>{item.pedido}</code></td>
                            <td>{item.codigoMarketplace}</td>
                            <td>R$ {item.valorTotal}</td>
                            <td><code>{item.notaFiscal}</code></td>
                            <td>{item.representante}</td>
                            <td>{item.data}</td>
                        </tr>
                    )}
                />

                <BlocoTabela
                    icone={Undo2}
                    titulo="NF de Devolução"
                    colunas={["NF", "Operação", "Valor", "Emissão", "Status SEFAZ"]}
                    linhas={notasDevolucao}
                    renderLinha={(item) => (
                        <tr key={item.id}>
                            <td><code>{item.notaFiscal}</code></td>
                            <td>{item.operacao}</td>
                            <td>{formatCurrency(item.valor)}</td>
                            <td>{item.emissao}</td>
                            <td>
                                <span className={pillClassSefaz(traduzStatusSefaz(item.statusSefaz))}>
                                    {traduzStatusSefaz(item.statusSefaz)}
                                </span>
                            </td>
                        </tr>
                    )}
                />

                <BlocoTabela
                    icone={CreditCard}
                    titulo="Títulos CREDEV"
                    colunas={["Fatura", "Valor", "Emissão", "Baixa", "Filial"]}
                    linhas={titulosCredev}
                    renderLinha={(item) => (
                        <tr key={item.id}>
                            <td><code>{item.fatura}</code></td>
                            <td>{formatCurrency(item.valor)}</td>
                            <td>{item.dataEmissao}</td>
                            <td>
                                <span className={pillClassBaixa(item.statusBaixa)}>
                                    {item.statusBaixa}
                                </span>
                            </td>
                            <td>{item.filial}</td>
                        </tr>
                    )}
                />

                <BlocoTabela
                    icone={Receipt}
                    titulo="Nota de Débito"
                    colunas={["Fatura", "Valor", "Emissão", "Vencimento", "Dias Atraso", "Filial"]}
                    linhas={notasDebito}
                    renderLinha={(item) => (
                        <tr key={item.id}>
                            <td><code>{item.fatura}</code></td>
                            <td>{formatCurrency(item.valor)}</td>
                            <td>{item.dataEmissao}</td>
                            <td>{item.dataVencimento}</td>
                            <td>
                                {item.diasAtraso > 0 ? (
                                    <span className="info-pill info-pill-atencao">{item.diasAtraso}d</span>
                                ) : "-"}
                            </td>
                            <td>{item.filial}</td>
                        </tr>
                    )}
                />
            </div>
        </section>
    );
}

export default InformacoesComplementares;
