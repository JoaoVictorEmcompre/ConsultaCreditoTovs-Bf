import { useState } from "react";
import "./ResumoCredito.css";
import SectionCollapseButton from "../common/SectionCollapseButton.jsx";
import {
    LuChartColumn as BarChart3,
    LuTriangleAlert as AlertTriangle,
    LuCalendar as Calendar,
    LuTimerReset as TimerReset,
    LuTag as Tag,
    LuCircleAlert as CircleAlert,
    LuHourglass as Hourglass,
    LuPiggyBank as PiggyBank,
    LuTrendingUp as TrendingUp,
    LuBanknote as Banknote,
    LuScale as Scale,
    LuShoppingBag as ShoppingBag,
    LuUndo2 as Undo2,
    LuCreditCard as CreditCardIcon,
    LuReceipt as Receipt,
    LuTicket as Ticket,
} from "react-icons/lu";

function formatCurrency(value) {
    if (value < 0) {
        return "R$ 0,00";
    }

    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

// Diferente de formatCurrency, esse não zera negativo — o Saldo pode
// legitimamente ficar negativo (créditos/antecipação maiores que o em aberto).
function formatCurrencyComSinal(value) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function CreditCard({ icon, label, value, sublabel, variant = "default" }) {
    return (
        <div className={`credit-card card-${variant}`}>
            <div className="credit-card-icon">{icon}</div>
            <div className="credit-card-info">
                <span className="credit-card-label">{label}</span>
                <span className="credit-card-value">{value}</span>
                {sublabel && <span className="credit-card-sublabel">{sublabel}</span>}
            </div>
        </div>
    );
}

function ResumoCredito({
    resumo,
    notasVenda = [],
    notasDevolucao = [],
    titulosCredev = [],
    notasDebito = [],
    ticketsZammad = [],
}) {
    const [colapsado, setColapsado] = useState(false);

    if (!resumo) {
        return null;
    }

    const calcSaldo = (totalEmAberto, saldoCredevEmAberto, antecipacaoEmAberto) => {
        return totalEmAberto - saldoCredevEmAberto - antecipacaoEmAberto;
    };

    const temLimite = resumo.limiteCreditoTotal > 0;
    const percentUtilizado = temLimite
        ? ((resumo.limiteCreditoUtilizado / resumo.limiteCreditoTotal) * 100).toFixed(1)
        : 0;
    const totalEmAberto = resumo.parcelasVencidas + resumo.parcelasAVencer;
    const notasDebitoOk = notasDebito.filter((nota) => nota.status === 1);

    return (
        <section className="resumo-section">
            <div className="section-header">
                <div className="section-title-group">
                    <BarChart3 size={20} />

                    <h2>Resumo de Cr&eacute;dito</h2>
                </div>
                <div className="section-header-actions">
                    <SectionCollapseButton
                        colapsado={colapsado}
                        onClick={() => setColapsado((v) => !v)}
                        label="Resumo de Crédito"
                    />
                </div>
            </div>

            {!colapsado && (
                <>
                    {/* COMENTADO PARA RETIRAR A BARRA DE LIMITE DE CRÉDITO, POIS NÃO ESTÁ SENDO USADA NO MOMENTO, POREM PODE SER USADA A QUALQUER MOMENTO, ENTÃO MANTIVE O CÓDIGO COMENTADO PARA FUTURAMENTE PODER USAR NOVAMENTE.
                        <div className="credit-bar-container">
                        <div className="credit-bar-labels">
                            <span>Utilizado: {formatCurrency(resumo.limiteCreditoUtilizado)}</span>
                            <span>Total: {formatCurrency(resumo.limiteCreditoTotal)}</span>
                        </div>
                        {temLimite ? (
                            <div className="credit-bar">
                                <div
                                    className="credit-bar-fill"
                                    style={{ width: `${Math.min(percentUtilizado, 100)}%` }}
                                >
                                    <span className="credit-bar-text">{percentUtilizado}%</span>
                                </div>
                            </div>
                        ) : (
                            <div className="credit-bar credit-bar-disabled">
                                <div className="credit-bar-fill-disabled">
                                    <span className="credit-bar-text-disabled">Cliente não possui limite disponível</span>
                                </div>
                            </div>
                        )}
                    </div> */}

                    <div className="resumo-grid">

                        <CreditCard
                            variant="total-aberto"
                            icon={
                                <Banknote size={20} />
                            }
                            label="Total Parcelas em Aberto"
                            value={formatCurrency(totalEmAberto)}
                        />

                        <CreditCard
                            variant="desconto"
                            icon={
                                <Tag size={20} />
                            }
                            label="Total de Desconto"
                            value={formatCurrency(resumo.totalDesconto)}
                        />

                        <CreditCard
                            variant="info-neg"
                            icon={
                                <TimerReset size={20} />
                            }
                            label="Maior Atraso"
                            value={`${resumo.maiorAtraso} Dias`}
                        />

                        <CreditCard
                            variant="vencido"
                            icon={
                                <AlertTriangle size={20} />
                            }
                            label="Parcelas Vencidas"
                            value={formatCurrency(resumo.parcelasVencidas)}
                        />

                        <CreditCard
                            variant="avencer"
                            icon={
                                <Calendar size={20} />
                            }
                            label="Parcelas A Vencer"
                            value={formatCurrency(resumo.parcelasAVencer)}
                        />

                        <CreditCard
                            variant="credev"
                            icon={
                                <PiggyBank size={20} />
                            }
                            label="CREDEV em Aberto"
                            value={formatCurrency(resumo.saldoCredevEmAberto)}
                        />

                        <CreditCard
                            variant="antecipacao"
                            icon={
                                <TrendingUp size={20} />
                            }
                            label="Antecipa&ccedil;&atilde;o em Aberto"
                            value={formatCurrency(resumo.antecipacaoEmAberto)}
                        />

                        <CreditCard
                            variant="saldo"
                            icon={
                                <Scale size={20} />
                            }
                            label="Saldo"
                            value={formatCurrencyComSinal(calcSaldo(totalEmAberto, resumo.saldoCredevEmAberto, resumo.antecipacaoEmAberto))}
                        />

                        <CreditCard
                            variant="info-neg"
                            icon={
                                <CircleAlert size={20} />
                            }
                            label="Títulos Vencidos"
                            value={`${resumo.countParcelasVencidas} Títulos`}
                        />

                        <CreditCard
                            variant="vencer"
                            icon={
                                <Hourglass size={20} />
                            }
                            label="Titulos à vencer"
                            value={`${resumo.pedidosAEntregar} Títulos`}
                        />

                        <CreditCard
                            variant="nf-venda"
                            icon={
                                <ShoppingBag size={20} />
                            }
                            label="NF de Venda"
                            value={`${notasVenda.length} NFs`}
                        />

                        <CreditCard
                            variant="nf-devolucao"
                            icon={
                                <Undo2 size={20} />
                            }
                            label="NF de Devolu&ccedil;&atilde;o"
                            value={`${notasDevolucao.length} NFs`}
                        />

                        <CreditCard
                            variant="titulos-credev"
                            icon={
                                <CreditCardIcon size={20} />
                            }
                            label="T&iacute;tulos CREDEV"
                            value={`${titulosCredev.length} Títulos`}
                        />

                        <CreditCard
                            variant="notas-debito"
                            icon={
                                <Receipt size={20} />
                            }
                            label="Notas de D&eacute;bito"
                            value={`${notasDebitoOk.length} Notas`}
                        />

                        <CreditCard
                            variant="zammad"
                            icon={
                                <Ticket size={20} />
                            }
                            label="Tickets Zammad"
                            value={`${ticketsZammad.length} Tickets`}
                        />
                    </div>
                </>
            )}
        </section>
    )
}

export default ResumoCredito;
