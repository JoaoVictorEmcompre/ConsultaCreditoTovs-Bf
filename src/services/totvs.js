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

        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar documentos:", error);
        throw error;
    }
};
