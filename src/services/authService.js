const PERMANENT_LOGIN_KEY = "permanentLogin";
const PERMANENT_LOGIN_DAYS = 3;

/**
 * @param {Date} date
 * @returns {string}
 */
function formatBrasilTime(date) {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/**
 * @param {string} userName
 */
export function savePermanentLogin(userName) {
    const permanentLoginData = {
        enabled: true,
        lastAccessDate: formatBrasilTime(new Date()),
        userName: userName,
    };

    try {
        localStorage.setItem(PERMANENT_LOGIN_KEY, JSON.stringify(permanentLoginData));
    } catch (error) {
        console.error("Erro ao salvar login permanente:", error);
    }
}

/**
 * @returns {Object|null}
 */
export function getPermanentLoginData() {
    try {
        const data = localStorage.getItem(PERMANENT_LOGIN_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error("Erro ao obter dados de login permanente:", error);
        return null;
    }
}

/**
 * @returns {boolean}
 */
export function isValidPermanentLogin() {
    const data = getPermanentLoginData();

    if (!data || !data.enabled || !data.lastAccessDate) {
        return false;
    }

    try {
        const [datePart, timePart] = data.lastAccessDate.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);

        const lastAccessDate = new Date(
            Date.UTC(year, month - 1, day, hour + 3, minute, second)
        );

        const nowDate = new Date();
        const diffMs = nowDate.getTime() - lastAccessDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        return diffDays <= PERMANENT_LOGIN_DAYS;
    } catch (error) {
        console.error("Erro ao validar login permanente:", error);
        return false;
    }
}

export function updateLastAccessDate() {
    const data = getPermanentLoginData();

    if (data) {
        data.lastAccessDate = formatBrasilTime(new Date());

        try {
            localStorage.setItem(PERMANENT_LOGIN_KEY, JSON.stringify(data));
        } catch (error) {
            console.error("Erro ao atualizar data de acesso:", error);
        }
    }
}

export function clearPermanentLogin() {
    try {
        localStorage.removeItem(PERMANENT_LOGIN_KEY);
    } catch (error) {
        console.error("Erro ao limpar login permanente:", error);
    }
}
