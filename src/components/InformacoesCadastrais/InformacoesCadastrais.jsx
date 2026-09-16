import {useState} from "react";
import "./InformacoesCadastrais.css";
import SectionCollapseButton from "../common/SectionCollapseButton.jsx";
import {
    LuUser as User,
    LuCalendar as Calendar,
    LuBuilding2 as Building2,
    LuMapPin as MapPin,
    LuMail as Mail,
    LuPhone as Phone,
    LuIdCard as IdCard,
    LuFileText as FileText,
    LuCalculator as Calculator,
    LuClipboardList as ClipboardList,
    LuHash as Hash,
} from "react-icons/lu";
import {FaWhatsapp} from "react-icons/fa";

function InfoItem({icon, label, value, className = ""}) {
    return (<div className={`info-item ${className}`.trim()}>
        <span className="info-icon">{icon}</span>
        <div className="info-text">
            <span className="info-label">{label}</span>
            <span className="info-value">{value || "---"}</span>
        </div>
    </div>);
}

function StatusBadge({situacao}) {
    const isAtiva = situacao === "Ativa";
    return (<span className={`status-badge ${isAtiva ? "status-ativa" : "status-inativa"}`}>
      <span className="status-dot"/>
        {situacao}
    </span>);
}

function InformacoesCadastrais({dados, onAbrirSimulador, onAbrirAcordo, ipInterno}) {
    const [colapsado, setColapsado] = useState(false);

    if (!dados) {
        return null;
    }

    const whatsappNumero = (dados.whatsapp || "").replace(/\D/g, "");
    const whatsappUrl = whatsappNumero ? `https://wa.me/55${whatsappNumero}` : "#";

    const documentoLabel = (dados.cnpj || "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";


    return (<section className="info-section">
        <div className="section-header">
            <div className="section-title-group">
                <User size={20}/>
                <h2>Informações Cadastrais</h2>
            </div>
            <div className="section-header-actions">
                <SectionCollapseButton
                    colapsado={colapsado}
                    onClick={() => setColapsado((v) => !v)}
                    label="Informações Cadastrais"
                />
            </div>
        </div>

        {!colapsado && (
        <div className="info-card">
            <div className="info-card-highlight">
                <div className="company-name">
                    <h3>{dados.razaoSocial}</h3>
                    <span className="nome-fantasia">{dados.nomeFantasia}</span>
                </div>
                <StatusBadge situacao={dados.situacao}/>
            </div>

            <div className="info-grid">
                <InfoItem
                    icon={<IdCard size={20}/>}
                    label={documentoLabel}
                    value={dados.cnpj}
                />
                <InfoItem
                    icon={<Hash size={20}/>}
                    label="C&oacute;digo do Cliente"
                    value={dados.codigoCliente}
                />
                <InfoItem
                    icon={<ClipboardList size={20}/>}
                    label="Inscri&ccedil;&atilde;o Estadual"
                    value={dados.inscricaoEstadual}
                />
                <InfoItem
                    icon={<MapPin size={20}/>}
                    label="Endere&ccedil;o"
                    value={`${dados.rua}, ${dados.numero} - ${dados.bairro}, ${dados.cidade} - ${dados.estado}, ${dados.cep}`}
                    className="info-item-full"
                />
                <InfoItem
                    icon={<Phone size={20}/>}
                    label="Telefone Fixo"
                    value={dados.telefoneFixo}
                />
                <InfoItem
                    icon={<FaWhatsapp size={20}/>}
                    label="WhatsApp"
                    value={dados.whatsapp}
                />
                <InfoItem
                    icon={<Mail size={20}/>}
                    label="E-mail"
                    value={dados.email}
                />
                <InfoItem
                    icon={<Building2 size={20}/>}
                    label="Divis&atilde;o de Neg&oacute;cios"
                    value={dados.divisaoNegocios}
                />
                <InfoItem
                    icon={<Calendar size={20}/>}
                    label="Data de Abertura"
                    value={dados.dataAbertura}
                />
            </div>

            <div className="info-acoes-rapidas">

                <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="acao-rapida-btn acao-whatsapp"
                    title="Abrir WhatsApp"
                >
                    <FaWhatsapp size={20}/>
                    WhatsApp
                </a>
                <a
                    href={`mailto:${dados.email}`}
                    className="acao-rapida-btn acao-email"
                    title="Enviar e-mail"
                >
                    <Mail size={20}/>
                    E-mail
                </a>
                <button
                    type="button"
                    className="acao-rapida-btn acao-simular"
                    onClick={onAbrirSimulador}
                    title="Simular acordo de negocia&ccedil;&atilde;o"
                >
                    <Calculator size={20}/>
                    Simular Acordo
                </button>
                {ipInterno && (
                    <button
                        type="button"
                        className="acao-rapida-btn acao-acordo"
                        onClick={onAbrirAcordo}
                        title="Gerar acordo de cr&eacute;dito"
                    >
                        <FileText size={20}/>
                        Acordo de Crédito
                    </button>
                )}

            </div>
        </div>
        )}
    </section>);
}

export default InformacoesCadastrais;
