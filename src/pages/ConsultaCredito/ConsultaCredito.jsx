import {useEffect, useState, useCallback, useRef} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {LuSearchCheck as SearchCheck} from "react-icons/lu";
import Header from "../../components/Header/Header.jsx";
import InformacoesCadastrais from "../../components/InformacoesCadastrais/InformacoesCadastrais.jsx";
import SituacaoFinanceira from "../../components/SituacaoFinanceira/SituacaoFinanceira.jsx";
import ResumoCredito from "../../components/ResumoCredito/ResumoCredito.jsx";
import InformacoesComplementares from "../../components/InformacoesComplementares/InformacoesComplementares.jsx";
import TicketsZammad from "../../components/TicketsZammad/TicketsZammad.jsx";
import SimuladorNegociacao from "../../components/SimuladorNegociacao/SimuladorNegociacao.jsx";
import AcordoCredito from "../../components/AcordoCredito/AcordoCredito.jsx";
import {
    searchLegalEntities,
    searchIndividuals,
    searchPersonByCode,
    searchCustomerFinancialBalance,
    searchDocuments,
    searchSalesInvoice,
    searchReturnInvoices,
    searchCredevTitles,
    searchDebitNotes,
} from "../../services/totvs.js";
import {searchZammadTicketsByCustomerCpfCnpj} from "../../services/zammad.js";
import {
    mapLegalEntityToDadosCadastrais,
    mapFinancialBalanceToResumoCredito,
    mapDocumentsToDuplicatas,
    mapFinancialBalanceToSaldoCredev,
    mapOrdersToNotasVenda,
    mapFiscalInvoicesToNotasDevolucao,
    mapDocumentsToCredevTitulos,
    mapDocumentsToNotasDebito,
} from "../../services/dataMapper.js";
import {pegarIP} from "../../services/pegarIP.js";
import {isValidPermanentLogin, updateLastAccessDate, clearPermanentLogin} from "../../services/authService.js";
import {DEFAULT_EXTERNAL_BRANCH_CODE} from "../../constants/branches.js";
import {INTERNAL_SEARCH_STORAGE_KEY} from "../../constants/storageKeys.js";
import "./ConsultaCredito.css";

function limparCnpj(valor = "") {
    return valor.replace(/\D/g, "");
}

function detectarCriterioBusca(valorLimpo) {
    if (valorLimpo.length === 11) return {tipo: "cpf", valor: valorLimpo};
    if (valorLimpo.length === 14) return {tipo: "cnpj", valor: valorLimpo};
    if (valorLimpo.length > 0) return {tipo: "codigo", valor: valorLimpo};
    return null;
}

function decodeBase64Url(valor = "") {
    try {
        let base64 = valor
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        while (base64.length % 4 !== 0) {
            base64 += "=";
        }

        return atob(base64);
    } catch {
        return "";
    }
}

function decodeCnpj(k = "") {
    const decoded = decodeBase64Url(k);
    const clean = limparCnpj(decoded);
    return clean.length === 11 || clean.length === 14 ? clean : "";
}

function ConsultaCredito() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const kParam = searchParams.get("k") || "";

    const [simuladorAberto, setSimuladorAberto] = useState(false);
    const [acordoAberto, setAcordoAberto] = useState(false);
    const [searchSeq, setSearchSeq] = useState(0);
    const [currentDadosCadastrais, setCurrentDadosCadastrais] = useState(null);
    const [currentDuplicatas, setCurrentDuplicatas] = useState([]);
    const [currentResumoCredito, setCurrentResumoCredito] = useState(null);
    const [currentInfoComplementar, setCurrentInfoComplementar] = useState({
        saldoCredev: null,
        notasVenda: [],
        notasDevolucao: [],
        titulosCredev: [],
        notasDebito: [],
    });
    const [currentTicketsZammad, setCurrentTicketsZammad] = useState([]);
    const [error, setError] = useState(null);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [validandoAcesso, setValidandoAcesso] = useState(true);
    const [isRedeInterna, setIsRedeInterna] = useState(false);
    const [kExterno, setKExterno] = useState("");
    const [branchCodeAtual, setBranchCodeAtual] = useState(DEFAULT_EXTERNAL_BRANCH_CODE);
    const [buscaInternaSalva, setBuscaInternaSalva] = useState(null);

    // Guarda a sequência da busca mais recente pra ignorar respostas de buscas
    // antigas que cheguem atrasadas — sem isso, se uma nova busca começar antes da
    // anterior terminar, quem responder por último "vence", mesmo sendo o cliente errado.
    const searchSeqRef = useRef(0);

    const handleSearch = useCallback(async (cnpj, branchCode = DEFAULT_EXTERNAL_BRANCH_CODE) => {
        const minhaSeq = ++searchSeqRef.current;
        const aindaAtual = () => searchSeqRef.current === minhaSeq;

        setSearching(true);
        setHasSearched(true);
        setSearchSeq(minhaSeq);
        setError(null);
        setBranchCodeAtual(branchCode);

        try {
            const cleanCnpj = limparCnpj(cnpj);
            const criterio = detectarCriterioBusca(cleanCnpj);

            if (!criterio) {
                setError("Informe um CNPJ, CPF ou código do cliente válido.");
                setCurrentDadosCadastrais(null);
                setCurrentResumoCredito(null);
                setCurrentDuplicatas([]);
                setCurrentInfoComplementar({
                    saldoCredev: null,
                    notasVenda: [],
                    notasDevolucao: [],
                    titulosCredev: [],
                    notasDebito: [],
                });
                setCurrentTicketsZammad([]);
                return;
            }

            const searchPerson = criterio.tipo === "cpf"
                ? searchIndividuals(criterio.valor)
                : criterio.tipo === "cnpj"
                    ? searchLegalEntities(criterio.valor)
                    : searchPersonByCode(criterio.valor);

            const criterioCliente = criterio.tipo === "codigo"
                ? {tipo: "codigo", valor: criterio.valor}
                : {tipo: "documento", valor: criterio.valor};

            const [legalEntityData, financialData, documentsData] = await Promise.all([
                searchPerson,
                searchCustomerFinancialBalance(criterioCliente, branchCode),
                searchDocuments(criterioCliente, branchCode),
            ]);

            // Uma busca mais nova já começou enquanto esperávamos essa resposta —
            // descarta o resultado atrasado pra não misturar dados de dois clientes.
            if (!aindaAtual()) return;

            if (legalEntityData.items?.length > 0) {
                const mappedDados = await mapLegalEntityToDadosCadastrais(legalEntityData.items[0]);
                setCurrentDadosCadastrais(mappedDados);
            } else {
                setCurrentDadosCadastrais(null);
            }

            if (financialData.items?.length > 0) {
                const mappedResumo = mapFinancialBalanceToResumoCredito(financialData, documentsData);
                setCurrentResumoCredito(mappedResumo);
            } else {
                setCurrentResumoCredito(null);
            }

            if (documentsData.items?.length > 0) {
                const mappedDuplicatas = mapDocumentsToDuplicatas(documentsData);
                setCurrentDuplicatas(mappedDuplicatas);
            } else {
                setCurrentDuplicatas([]);
            }

            // Saldo CREDEV não é uma busca nova — vem do mesmo financialData acima,
            // que já pede isRefundCredit:true. As outras 4 são buscas à parte,
            // isoladas num allSettled pra uma falha aqui não derrubar a tela toda.
            const saldoCredev = financialData.items?.length > 0
                ? mapFinancialBalanceToSaldoCredev(financialData)
                : null;

            const cpfCnpjComplementar = criterio.tipo !== "codigo"
                ? criterio.valor
                : limparCnpj(legalEntityData.items?.[0]?.cnpj || legalEntityData.items?.[0]?.cpf || "") || null;

            if (!cpfCnpjComplementar) {
                setCurrentInfoComplementar({
                    saldoCredev,
                    notasVenda: [],
                    notasDevolucao: [],
                    titulosCredev: [],
                    notasDebito: [],
                });
                setCurrentTicketsZammad([]);
            } else {
                const [notasVendaResult, notasDevolucaoResult, titulosCredevResult, notasDebitoResult] =
                    await Promise.allSettled([
                        searchSalesInvoice(cpfCnpjComplementar, branchCode),
                        searchReturnInvoices(cpfCnpjComplementar, branchCode),
                        searchCredevTitles(cpfCnpjComplementar, branchCode),
                        searchDebitNotes(cpfCnpjComplementar, branchCode),
                    ]);

                const notasVenda = notasVendaResult.status === "fulfilled"
                    ? mapOrdersToNotasVenda(notasVendaResult.value)
                    : [];
                const notasDevolucao = notasDevolucaoResult.status === "fulfilled"
                    ? mapFiscalInvoicesToNotasDevolucao(notasDevolucaoResult.value)
                    : [];
                const titulosCredev = titulosCredevResult.status === "fulfilled"
                    ? mapDocumentsToCredevTitulos(titulosCredevResult.value)
                    : [];
                const notasDebito = notasDebitoResult.status === "fulfilled"
                    ? mapDocumentsToNotasDebito(notasDebitoResult.value)
                    : [];

                if (!aindaAtual()) return;

                setCurrentInfoComplementar({
                    saldoCredev,
                    notasVenda,
                    notasDevolucao,
                    titulosCredev,
                    notasDebito,
                });

                // Isolado do try principal: se o Zammad falhar, o resto da
                // consulta já carregada continua de pé.
                try {
                    const ticketsZammad = await searchZammadTicketsByCustomerCpfCnpj(cpfCnpjComplementar);
                    if (aindaAtual()) setCurrentTicketsZammad(ticketsZammad);
                } catch (zammadError) {
                    console.error("Erro ao buscar tickets Zammad:", zammadError);
                    if (aindaAtual()) setCurrentTicketsZammad([]);
                }
            }
        } catch (err) {
            if (!aindaAtual()) return;
            setError(err.message || "Erro ao buscar dados. Verifique o CNPJ e tente novamente.");
            setCurrentDadosCadastrais(null);
            setCurrentResumoCredito(null);
            setCurrentDuplicatas([]);
            setCurrentInfoComplementar({
                saldoCredev: null,
                notasVenda: [],
                notasDevolucao: [],
                titulosCredev: [],
                notasDebito: [],
            });
            setCurrentTicketsZammad([]);
        } finally {
            if (aindaAtual()) setSearching(false);
        }
    }, []);

    useEffect(() => {
        const login = sessionStorage.getItem("usuario-logado") === "true";

        async function validarAcesso() {
            try {
                const ipUser = await pegarIP();

                const IPS_INTERNOS = (import.meta.env.VITE_IPS_INTERNOS || "")
                    .split(",")
                    .map((ip) => ip.trim())
                    .filter(Boolean);

                const ehInterno = IPS_INTERNOS.includes(ipUser);

                setIsRedeInterna(ehInterno);
                sessionStorage.setItem("ip-interno", ehInterno ? "true" : "false");

                if (ehInterno) {
                    // Recupera a última busca feita nessa aba — se o usuário
                    // recarregar a página por acidente, o cliente não se perde.
                    try {
                        const salvo = JSON.parse(sessionStorage.getItem(INTERNAL_SEARCH_STORAGE_KEY) || "null");
                        if (salvo?.cnpj && salvo?.branchCode) {
                            setBuscaInternaSalva(salvo);
                        }
                    } catch {
                        // dado corrompido no sessionStorage — segue sem restaurar.
                    }

                    if (!login) {
                        if (isValidPermanentLogin()) {
                            sessionStorage.setItem("usuario-logado", "true");
                            updateLastAccessDate();
                            setValidandoAcesso(false);
                            return;
                        } else {
                            clearPermanentLogin();
                            navigate("/login", {replace: true});
                            return;
                        }
                    }

                    setValidandoAcesso(false);
                    return;
                }

                const kDaUrl = kParam.trim();
                const kSalvo = (sessionStorage.getItem("externo-k") || "").trim();
                const kFinal = kDaUrl || kSalvo;

                const cnpjDecodificado = decodeCnpj(kFinal);

                if (!kFinal || !cnpjDecodificado) {
                    setError("Acesso externo inválido. Parâmetro ausente ou inválido.");
                    setValidandoAcesso(false);
                    return;
                }

                setKExterno(kFinal);
                sessionStorage.setItem("externo-k", kFinal);

                if (kDaUrl) {
                    window.history.replaceState({}, "", import.meta.env.BASE_URL);
                }
            } catch (err) {
                console.error("Erro ao validar acesso:", err);
                setError("Não foi possível validar o acesso.");
            } finally {
                setValidandoAcesso(false);
            }
        }

        validarAcesso();
    }, [navigate, kParam]);

    useEffect(() => {
        if (validandoAcesso) return;
        if (isRedeInterna) return;
        if (!kExterno) return;

        const cnpjDecodificado = decodeCnpj(kExterno);

        if (cnpjDecodificado) {
            handleSearch(cnpjDecodificado);
        } else {
            setError("Não foi possível interpretar o acesso externo.");
        }
    }, [validandoAcesso, isRedeInterna, kExterno, handleSearch]);

    useEffect(() => {
        if (validandoAcesso) return;
        if (!isRedeInterna) return;
        if (!buscaInternaSalva) return;

        handleSearch(buscaInternaSalva.cnpj, buscaInternaSalva.branchCode);
    }, [validandoAcesso, isRedeInterna, buscaInternaSalva, handleSearch]);

    if (validandoAcesso) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="consulta-page">
            <Header
                onSearch={handleSearch}
                redeInterna={isRedeInterna}
                cnpjInicial={buscaInternaSalva?.cnpj || ""}
                branchCodeInicial={buscaInternaSalva?.branchCode || ""}
            />

            <main className="consulta-content">
                {error && (
                    <div className="error-banner">
                        <p>{error}</p>
                    </div>
                )}

                {searching ? (
                    <div className="consulta-loading">
                        <div className="spinner"></div>
                        <p>Carregando dados do cliente...</p>
                    </div>
                ) : hasSearched ? (
                    <>
                        <InformacoesCadastrais
                            key={`cadastrais-${searchSeq}`}
                            dados={currentDadosCadastrais}
                            onAbrirSimulador={() => setSimuladorAberto(true)}
                            onAbrirAcordo={() => setAcordoAberto(true)}
                            ipInterno={isRedeInterna}
                        />

                        <ResumoCredito
                            key={`resumo-${searchSeq}`}
                            resumo={currentResumoCredito}
                            mostrarLimiteCredito={branchCodeAtual === 1}
                            notasVenda={currentInfoComplementar.notasVenda}
                            notasDevolucao={currentInfoComplementar.notasDevolucao}
                            titulosCredev={currentInfoComplementar.titulosCredev}
                            notasDebito={currentInfoComplementar.notasDebito}
                            ticketsZammad={currentTicketsZammad}
                        />
                        <SituacaoFinanceira
                            key={`financeira-${searchSeq}`}
                            duplicatas={currentDuplicatas}
                            mostrarFilial={Array.isArray(branchCodeAtual) && branchCodeAtual.length > 1}
                        />
                        <InformacoesComplementares key={`complementares-${searchSeq}`} info={currentInfoComplementar}/>
                        <TicketsZammad key={`zammad-${searchSeq}`} tickets={currentTicketsZammad}/>
                    </>
                ) : (
                    isRedeInterna && (
                        <div className="consulta-boas-vindas">
                            <div className="consulta-boas-vindas-icon">
                                <SearchCheck size={28}/>
                            </div>
                            <h2>Busque um cliente para começar</h2>
                            <p>Informe o CNPJ, CPF ou código do cliente no campo de busca acima para ver os dados de crédito.</p>
                        </div>
                    )
                )}
            </main>

            <SimuladorNegociacao
                duplicatas={currentDuplicatas}
                aberto={simuladorAberto}
                onFechar={() => setSimuladorAberto(false)}
            />

            {isRedeInterna && (
                <AcordoCredito
                    duplicatas={currentDuplicatas}
                    dadosCadastrais={currentDadosCadastrais}
                    aberto={acordoAberto}
                    onFechar={() => setAcordoAberto(false)}
                />
            )}

        </div>
    );
}

export default ConsultaCredito;
