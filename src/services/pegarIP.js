export async function pegarIP() {
    try {
        const resposta = await fetch('https://api.ipify.org?format=json');
        const dados = await resposta.json();
        return dados.ip;
    } catch (erro) {
        console.error("Erro ao buscar o IP:", erro);
    }
}