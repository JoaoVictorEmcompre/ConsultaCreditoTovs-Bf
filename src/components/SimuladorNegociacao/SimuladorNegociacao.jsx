import {useState, useMemo} from "react";
import "./SimuladorNegociacao.css";
import {LuFileText as FileText, LuX as X} from "react-icons/lu";
import EmptyState from "../common/EmptyState.jsx";

function formatCurrency(value) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function SimuladorNegociacao({duplicatas, aberto, onFechar}) {
    const [selecionadas, setSelecionadas] = useState([]);
    const [tipoAcordo, setTipoAcordo] = useState("Quitação");
    const [parcelas, setParcelas] = useState(1);

    const duplicatasVencidas = duplicatas.filter(
        (d) => d.statusPagamento !== "Pago" && d.statusPagamento !== "Pago com Atraso"
    );

    const toggleSelecao = (id) => {
        setSelecionadas((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const toggleTodas = () => {
        if (selecionadas.length === duplicatasVencidas.length) {
            setSelecionadas([]);
        } else {
            setSelecionadas(duplicatasVencidas.map((d) => d.id));
        }
    };

    const simulacao = useMemo(() => {
        const itens = duplicatasVencidas.filter((d) => selecionadas.includes(d.id));
        if (itens.length === 0) return null;

        const subtotal = itens.reduce((acc, d) => acc + d.valor, 0);
        const diasAtrasoMax = Math.max(...itens.map((d) => d.diasAtraso));

        if (tipoAcordo === "Quitação") {
            return {
                subtotal,
                juros: 0,
                totalComEncargos: subtotal,
                totalFinal: subtotal,
                numParcelas: 1,
                valorParcela: subtotal,
                diasAtrasoMax,
            };
        }

        const taxaMensal = 5 / 100;
        const n = parcelas;
        const fator = Math.pow(1 + taxaMensal, n);
        const valorParcela = subtotal * (taxaMensal * fator) / (fator - 1);
        const totalFinal = valorParcela * n;
        const juros = totalFinal - subtotal;

        return {
            subtotal,
            juros,
            totalComEncargos: totalFinal,
            totalFinal,
            numParcelas: n,
            valorParcela,
            diasAtrasoMax,
        };
    }, [selecionadas, duplicatasVencidas, tipoAcordo, parcelas]);

    if (!aberto) return null;

    return (
        <div className="simulador-overlay" onClick={onFechar}>
            <div className="simulador-modal" onClick={(e) => e.stopPropagation()}>
                <div className="simulador-header">
                    <div className="simulador-title-group">
                        <FileText size={20}/>
                        <h2>Simulador de Negociação</h2>
                    </div>
                    <button className="simulador-fechar" onClick={onFechar}>
                        <X size={20}/>
                    </button>
                </div>

                <div className="simulador-body">
                    <div className="simulador-selecao">
                        <div className="selecao-header">
                            <h3>Selecione as duplicatas vencidas</h3>
                            <button type="button" className="btn-selecionar-todas" onClick={toggleTodas}>
                                {selecionadas.length === duplicatasVencidas.length ? "Desmarcar Todas" : "Selecionar Todas"}
                            </button>
                        </div>

                        {duplicatasVencidas.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title="Nenhuma duplicata vencida encontrada"
                                subtitle="Esse cliente não possui duplicatas vencidas para simular."
                            />
                        ) : (
                            <div className="duplicatas-lista">
                                {duplicatasVencidas.map((dup) => (
                                    <label key={dup.id}
                                           className={`duplicata-check ${selecionadas.includes(dup.id) ? "duplicata-selecionada" : ""}`}>
                                        <input
                                            type="checkbox"
                                            checked={selecionadas.includes(dup.id)}
                                            onChange={() => toggleSelecao(dup.id)}
                                        />
                                        <div className="duplicata-check-info">
                                            <code>{dup.duplicata}</code>
                                            <span className="duplicata-check-parcela">{dup.parcela}</span>
                                        </div>
                                        <span className="duplicata-check-valor">{formatCurrency(dup.valor)}</span>
                                        <span
                                            className={dup.diasAtraso > 0 ? "duplicata-check-atraso" : "duplicata-check-a-vencer"}>
                                            {dup.diasAtraso > 0 ? `${dup.diasAtraso}d atraso` : "A vencer"}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="simulador-config">
                        <div className="config-row">
                            <div className="form-group">
                                <label className="form-label">Tipo de Acordo</label>
                                <select
                                    className="form-select"
                                    value={tipoAcordo}
                                    onChange={(e) => {
                                        setTipoAcordo(e.target.value);
                                        if (e.target.value === "Quitação") setParcelas(1);
                                        else setParcelas(2);
                                    }}
                                >
                                    <option value="Quitação">Quitação (À Vista)</option>
                                    <option value="Parcelamento">Parcelamento</option>
                                </select>
                            </div>

                            {tipoAcordo === "Parcelamento" && (
                                <div className="form-group">
                                    <label className="form-label">Parcelas</label>
                                    <select
                                        className="form-select"
                                        value={parcelas}
                                        onChange={(e) => setParcelas(Number(e.target.value))}
                                    >
                                        {Array.from({length: 5}, (_, i) => i + 2).map((n) => (
                                            <option key={n} value={n}>{n}x</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="simulador-taxas">
                            {tipoAcordo === "Parcelamento"
                                ? <span>Juros: 5% a.m.</span>
                                : <span>Sem juros para quitação à vista</span>
                            }
                        </div>
                    </div>

                    {simulacao && (
                        <div className="simulador-resultado">
                            <h3>Resultado da Simulação</h3>
                            <div className="resultado-linhas">
                                <div className="resultado-linha">
                                    <span>Subtotal (dívidas selecionadas)</span>
                                    <span>{formatCurrency(simulacao.subtotal)}</span>
                                </div>
                                <div className="resultado-linha">
                                    <span>Juros ({simulacao.diasAtrasoMax}d de atraso)</span>
                                    <span>+ {formatCurrency(simulacao.juros)}</span>
                                </div>
                                <div className="resultado-linha resultado-total">
                                    <span>Total Final</span>
                                    <span>{formatCurrency(simulacao.totalFinal)}</span>
                                </div>
                                {simulacao.numParcelas > 1 && (
                                    <div className="resultado-linha resultado-parcela">
                                        <span>{simulacao.numParcelas}x de</span>
                                        <span>{formatCurrency(simulacao.valorParcela)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SimuladorNegociacao;
