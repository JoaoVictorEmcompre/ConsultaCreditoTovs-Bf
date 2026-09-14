const API_BASE_URL = import.meta.env.VITE_API_TOTVS_BASE_URL;
const CLIENT_ID = import.meta.env.VITE_API_TOTVS_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_API_TOTVS_CLIENT_SECRET;
const USERNAME = import.meta.env.VITE_API_TOTVS_USERNAME;
const PASSWORD = import.meta.env.VITE_API_TOTVS_PASSWORD;

let accessToken = null;
let tokenExpiresAt = null;
let tokenRequestInFlight = null;

const requestToken = async () => {
    const response = await fetch(
        `${API_BASE_URL}/api/totvsmoda/authorization/v2/token`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "password",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                username: USERNAME,
                password: PASSWORD,
            }).toString(),
        }
    );

    if (!response.ok) {
        throw new Error(`Token generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000 || 3600000);
    return accessToken;
};

// Buscas de um mesmo cliente disparam várias requisições em paralelo; sem essa
// deduplicação, cada uma gera seu próprio token ao mesmo tempo e a TOTVS derruba
// as concorrentes, causando "Token generation failed" mesmo com credenciais corretas.
const generateToken = async () => {
    if (tokenRequestInFlight) {
        return tokenRequestInFlight;
    }

    tokenRequestInFlight = requestToken()
        .catch((error) => {
            console.error("Erro ao gerar token TOTVS:", error);
            throw error;
        })
        .finally(() => {
            tokenRequestInFlight = null;
        });

    return tokenRequestInFlight;
};

const getValidToken = async () => {
    if (!accessToken || !tokenExpiresAt || Date.now() >= tokenExpiresAt) {
        return generateToken();
    }
    return accessToken;
};

const fetchWithToken = (endpoint, body, token) =>
    fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

const makeRequest = async (endpoint, body) => {
    try {
        let token;
        try {
            token = await getValidToken();
        } catch {
            // Token falhou (ex.: instabilidade pontual na TOTVS) — força gerar de novo
            // antes de desistir, em vez de propagar o erro na primeira tentativa.
            accessToken = null;
            tokenExpiresAt = null;
            token = await generateToken();
        }

        const response = await fetchWithToken(endpoint, body, token);

        if (response.status === 401) {
            accessToken = null;
            tokenExpiresAt = null;
            const newToken = await generateToken();

            return fetchWithToken(endpoint, body, newToken);
        }

        return response;
    } catch (error) {
        console.error("Erro na requisição TOTVS:", error);
        throw error;
    }
};

export const searchLegalEntities = async (cnpjOuCodigo, porCodigo = false) => {
    try {
        const response = await makeRequest(
            "/api/totvsmoda/person/v2/legal-entities/search",
            {
                filter: porCodigo
                    ? {personCodeList: [cnpjOuCodigo]}
                    : {cnpjList: [cnpjOuCodigo]},
                expand:
                    "phones,addresses,emails,classifications,additionalFields,references,observations,relateds,partners,shippingCompany,contacts,statistics,paymentMethods,preferences,socialNetworks,representatives,customerObservations",
                page: 1,
                pageSize: 10,
            }
        );

        if (!response.ok) {
            throw new Error(
                `Search failed: ${response.statusText}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar dados cadastrais:", error);
        throw error;
    }
};

export const searchIndividuals = async (cpfOuCodigo, porCodigo = false) => {
    try {
        const response = await makeRequest(
            "/api/totvsmoda/person/v2/individuals/search",
            {
                filter: porCodigo
                    ? {personCodeList: [cpfOuCodigo]}
                    : {cpfList: [cpfOuCodigo]},
                expand:
                    "phones,addresses,emails,classifications,additionalFields,references,observations,customerObservations,relateds,shippingCompany,statistics,representatives,preferences",
                page: 1,
                pageSize: 10,
            }
        );

        if (!response.ok) {
            throw new Error(
                `Search failed: ${response.statusText}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar dados cadastrais:", error);
        throw error;
    }
};

export const searchPersonByCode = async (customerCode) => {
    const [legalEntity, individual] = await Promise.allSettled([
        searchLegalEntities(customerCode, true),
        searchIndividuals(customerCode, true),
    ]);

    if (legalEntity.status === "fulfilled" && legalEntity.value.items?.length > 0) {
        return legalEntity.value;
    }

    if (individual.status === "fulfilled" && individual.value.items?.length > 0) {
        return individual.value;
    }

    if (legalEntity.status === "fulfilled") return legalEntity.value;
    if (individual.status === "fulfilled") return individual.value;

    throw legalEntity.reason || individual.reason;
};

const buildCustomerFilter = ({tipo, valor}) =>
    tipo === "codigo" ? {customerCodeList: [valor]} : {customerCpfCnpjList: [valor]};

export const searchCustomerFinancialBalance = async (criterioCliente, branchCode) => {
    try {
        const response = await makeRequest(
            "/api/totvsmoda/accounts-receivable/v2/customer-financial-balance/search",
            {
                filter: buildCustomerFilter(criterioCliente),
                option: {
                    branchCodeList: Array.isArray(branchCode) ? branchCode : [branchCode],
                    isLimit: true,
                    isOpenInvoice: true,
                    isRefundCredit: true,
                    isAdvanceAmount: true,
                    isDofni: true,
                    isDofniCheck: true,
                    isTransactionOut: true,
                    isConsigned: true,
                    isInvoiceBehindSchedule: true,
                    dateInvoiceBehindSchedule: new Date().toISOString(),
                    isSalesOrderAdvance: true,
                },
                page: 1,
                pageSize: 10,
            }
        );

        if (!response.ok) {
            throw new Error(
                `Search failed: ${response.statusText}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar limite de crédito:", error);
        throw error;
    }
};

// A filial 6 às vezes retorna dados de parcela inconsistentes na busca em lote;
// pra essas linhas, refazemos a busca isolada por número da fatura (receivableCode)
// + data de emissão e usamos o retorno dela como fonte de verdade pros valores/datas/status.
const validateBranch6Document = async ({receivableCode, issueDate}) => {
    try {
        const response = await makeRequest(
            "/api/totvsmoda/accounts-receivable/v2/documents/search",
            {
                filter: {
                    branchCodeList: [6],
                    receivableCodeList: [receivableCode],
                    startIssueDate: issueDate,
                    endIssueDate: issueDate,
                },
                expand: "invoice",
                page: 1,
                pageSize: 100,
            }
        );

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Erro ao validar documento da filial 6:", error);
        return null;
    }
};

const validarDocumentosFilial6 = async (documents) => {
    const itensFilial6 = documents.items.filter((doc) => doc.branchCode === 6);
    if (itensFilial6.length === 0) return documents;

    // A busca de validação não filtra por cliente, só por fatura (receivableCode)
    // + data — então parcelas da mesma fatura/dia reaproveitam a mesma chamada.
    const gruposParaValidar = new Map();
    itensFilial6.forEach((doc) => {
        const chave = `${doc.receivableCode}|${doc.issueDate}`;
        if (!gruposParaValidar.has(chave)) {
            gruposParaValidar.set(chave, {
                receivableCode: doc.receivableCode,
                issueDate: doc.issueDate,
            });
        }
    });

    const chavesGrupo = Array.from(gruposParaValidar.keys());
    const resultadosValidacao = await Promise.all(
        chavesGrupo.map((chave) => validateBranch6Document(gruposParaValidar.get(chave)))
    );

    // Resposta bruta (pode trazer mais de um cliente, já que não filtramos por
    // customerCode) de cada grupo, guardada à parte pra exibir na tela.
    const respostaBrutaPorGrupo = new Map();
    chavesGrupo.forEach((chave, index) => {
        respostaBrutaPorGrupo.set(chave, resultadosValidacao[index]);
    });

    // A mesma fatura pode voltar vinculada a mais de um cliente. Não importa de
    // quem é — se algum dos retornos estiver com problema (sem pagamento), é
    // esse que vale pra linha normal, não o cliente que estamos consultando.
    const itensPorParcela = new Map();
    resultadosValidacao.forEach((resultado) => {
        resultado?.items?.forEach((item) => {
            const chave = `${item.receivableCode}|${item.installmentCode}`;
            if (!itensPorParcela.has(chave)) itensPorParcela.set(chave, []);
            itensPorParcela.get(chave).push(item);
        });
    });

    const escolherItemValidado = (itens) => {
        if (!itens || itens.length === 0) return null;
        return itens.find((item) => !item.paymentDate) || itens[0];
    };

    const itemsAtualizados = documents.items.map((doc) => {
        if (doc.branchCode !== 6) return doc;

        const chaveGrupo = `${doc.receivableCode}|${doc.issueDate}`;
        const validacaoFilial6 = respostaBrutaPorGrupo.get(chaveGrupo) || null;
        const candidatos = itensPorParcela.get(`${doc.receivableCode}|${doc.installmentCode}`);
        const validado = escolherItemValidado(candidatos);

        if (!validado) return {...doc, validacaoFilial6};

        return {
            ...doc,
            installmentValue: validado.installmentValue,
            paidValue: validado.paidValue,
            issueDate: validado.issueDate,
            expiredDate: validado.expiredDate,
            paymentDate: validado.paymentDate,
            validacaoFilial6,
        };
    });

    return {...documents, items: itemsAtualizados};
};

export const searchDocuments = async (criterioCliente, branchCode) => {
    try {
        const response = await makeRequest(
            "/api/totvsmoda/accounts-receivable/v2/documents/search",
            {
                filter: {
                    ...buildCustomerFilter(criterioCliente),
                    branchCodeList: Array.isArray(branchCode) ? branchCode : [branchCode],
                },
                expand: "check,invoice,commissioneds,calculateValue",
                page: 1,
                pageSize: 100,
            }
        );

        if (!response.ok) {
            throw new Error(
                `Search failed: ${response.statusText}`
            );
        }

        const documents = await response.json();

        const incluiFilial6 = Array.isArray(branchCode) ? branchCode.includes(6) : branchCode === 6;
        if (incluiFilial6) {
            return await validarDocumentosFilial6(documents);
        }

        return documents;
    } catch (error) {
        console.error("Erro ao buscar documentos:", error);
        throw error;
    }
};
