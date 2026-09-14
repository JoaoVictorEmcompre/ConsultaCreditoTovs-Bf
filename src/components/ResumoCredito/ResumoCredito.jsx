import "./ResumoCredito.css";
import {
    BarChart3,
    Wallet,
    CreditCard as CreditCardIcon,
    AlertTriangle,
    Calendar,
    ClipboardCheck,
    TimerReset,
    Clock,
    CircleAlert,
    Hourglass,
} from "lucide-react";

function formatCurrency(value) {
    if (value < 0) {
        return "R$ 0,00";
    }

    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function CreditCard({icon, label, value, sublabel, variant = "default"}) {
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

function ResumoCredito({resumo}) {
    if (!resumo) {
        return null;
    }

    const temLimite = resumo.limiteCreditoTotal > 0;
    const percentUtilizado = temLimite
        ? ((resumo.limiteCreditoUtilizado / resumo.limiteCreditoTotal) * 100).toFixed(1)
        : 0;

    return (
        <section className="resumo-section">
            <div className="section-header">
                <div className="section-title-group">
                    <BarChart3 size={20}/>

                    <h2>Resumo de Cr&eacute;dito</h2>
                </div>
            </div>

            <div className="credit-bar-container">
                <div className="credit-bar-labels">
                    <span>Utilizado: {formatCurrency(resumo.limiteCreditoUtilizado)}</span>
                    <span>Total: {formatCurrency(resumo.limiteCreditoTotal)}</span>
                </div>
                {temLimite ? (
                    <div className="credit-bar">
                        <div
                            className="credit-bar-fill"
                            style={{width: `${Math.min(percentUtilizado, 100)}%`}}
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
            </div>

            <div className="resumo-grid">

                <CreditCard
                    variant="total"
                    icon={
                        <Wallet size={20}/>
                    }
                    label="Limite de Cr&eacute;dito Total"
                    value={formatCurrency(resumo.limiteCreditoTotal)}
                />

                <CreditCard
                    variant="utilizado"
                    icon={
                        <CreditCardIcon size={20}/>
                    }
                    label="Cr&eacute;dito Utilizado"
                    value={formatCurrency(resumo.limiteCreditoUtilizado)}
                />

                <CreditCard
                    variant="disponivel"
                    icon={
                        <Wallet size={20}/>
                    }
                    label="Limite Dispon&iacute;vel"
                    value={formatCurrency(resumo.limiteDisponivel)}
                />

                <CreditCard
                    variant="vencido"
                    icon={
                        <AlertTriangle size={20}/>
                    }
                    label="Parcelas Vencidas"
                    value={formatCurrency(resumo.parcelasVencidas)}
                />

                <CreditCard
                    variant="avencer"
                    icon={
                        <Calendar size={20}/>
                    }
                    label="Parcelas A Vencer"
                    value={formatCurrency(resumo.parcelasAVencer)}
                />

                <CreditCard
                    variant="info"
                    icon={
                        <ClipboardCheck size={20}/>
                    }
                    label="&Uacute;ltima Revis&atilde;o de Cr&eacute;dito"
                    value={resumo.dataUltimaRevisao}
                />

                <CreditCard
                    variant="info-neg"
                    icon={
                        <TimerReset size={20}/>
                    }
                    label="Maior Atraso"
                    value={`${resumo.maiorAtraso} Dias`}
                />

                <CreditCard
                    variant="info-neg"
                    icon={
                        <Clock size={20}/>
                    }
                    label="Média de Atraso (12m)"
                    value={`${resumo.prazoMedioAtraso12m} Dias`}
                />

                <CreditCard
                    variant="info-neg"
                    icon={
                        <CircleAlert size={20}/>
                    }
                    label="Títulos Vencidos"
                    value={`${resumo.countParcelasVencidas} Títulos`}
                />

                <CreditCard
                    variant="vencer"
                    icon={
                        <Hourglass size={20}/>
                    }
                    label="Titulos à vencer"
                    value={`${resumo.pedidosAEntregar} Títulos`}
                />
            </div>
        </section>
    )
}

export default ResumoCredito;
