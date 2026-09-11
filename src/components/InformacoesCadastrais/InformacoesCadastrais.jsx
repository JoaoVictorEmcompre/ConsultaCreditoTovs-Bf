import "./InformacoesCadastrais.css";
import {CiUser, CiCalendarDate} from "react-icons/ci";
import {MdBusiness, MdLocationOn, MdEmail} from "react-icons/md";
import {FaWhatsapp, FaPhoneAlt} from "react-icons/fa";
import {HiIdentification, HiOutlineDocumentText} from "react-icons/hi2";
import {BsCalculator, BsCardChecklist} from "react-icons/bs";

function InfoItem({icon, label, value}) {
    return (<div className="info-item">
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
    if (!dados) {
        return null;
    }

    const whatsappNumero = (dados.whatsapp || "").replace(/\D/g, "");
    const whatsappUrl = whatsappNumero ? `https://wa.me/55${whatsappNumero}` : "#";


    return (<section className="info-section">
        <div className="section-header">
            <div className="section-title-group">
                <CiUser size={20}/>
                <h2>Informações Cadastrais</h2>
            </div>
            <div className="section-header-actions">
                <StatusBadge situacao={dados.situacao}/>
            </div>
        </div>

        <div className="info-card">
            <div className="info-card-highlight">
                <div className="company-name">
                    <h3>{dados.razaoSocial}</h3>
                    <span className="nome-fantasia">{dados.nomeFantasia}</span>
                </div>
            </div>

            <div className="info-grid">
                <InfoItem
                    icon={<HiIdentification size={20}/>}
                    label="CNPJ"
                    value={dados.cnpj}
                />
                <InfoItem
                    icon={<BsCardChecklist size={20}/>}
                    label="Inscri&ccedil;&atilde;o Estadual"
                    value={dados.inscricaoEstadual}
                />
                <InfoItem
                    icon={<MdLocationOn size={20}/>}
                    label="Endere&ccedil;o"
                    value={`${dados.rua}, ${dados.numero} - ${dados.bairro}, ${dados.cidade} - ${dados.estado}, ${dados.cep}`}
                />
                <InfoItem
                    icon={<FaPhoneAlt size={20}/>}
                    label="Telefone Fixo"
                    value={dados.telefoneFixo}
                />
                <InfoItem
                    icon={<FaWhatsapp size={20}/>}
                    label="WhatsApp"
                    value={dados.whatsapp}
                />
                <InfoItem
                    icon={<MdEmail size={20}/>}
                    label="E-mail"
                    value={dados.email}
                />
                <InfoItem
                    icon={<MdBusiness size={20}/>}
                    label="Divis&atilde;o de Neg&oacute;cios"
                    value={dados.divisaoNegocios}
                />
                <InfoItem
                    icon={<CiCalendarDate size={20}/>}
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
                    <MdEmail size={20}/>
                    E-mail
                </a>
                <button
                    type="button"
                    className="acao-rapida-btn acao-simular"
                    onClick={onAbrirSimulador}
                    title="Simular acordo de negocia&ccedil;&atilde;o"
                >
                    <BsCalculator size={20}/>
                    Simular Acordo
                </button>
                {ipInterno && (
                    <button
                        type="button"
                        className="acao-rapida-btn acao-acordo"
                        onClick={onAbrirAcordo}
                        title="Gerar acordo de cr&eacute;dito"
                    >
                        <HiOutlineDocumentText size={20}/>
                        Acordo de Crédito
                    </button>
                )}

            </div>
        </div>
    </section>);
}

export default InformacoesCadastrais;
