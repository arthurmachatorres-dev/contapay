// ================= CONFIGURAÇÃO DO FIREBASE =================
const firebaseConfig = {
    apiKey: "AIzaSyCXv0HFkbnUlGFKaAC19MsyEngoVGZ124o",
    authDomain: "contapay.firebaseapp.com",
    projectId: "contapay",
    storageBucket: "contapay.firebasestorage.app",
    messagingSenderId: "659266840228",
    appId: "1:659266840228:web:7fe6ff92e45f481d28e831",
    measurementId: "G-1V8JEJWCEL"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================= ESTADO EM MEMÓRIA DO USUÁRIO LOGADO =================
let currentUser = null;
let userTransactions = [];
let userTags = [];

const defaultTags = [
    { id: "tag-geral", name: "Geral", color: "#102D50" },
    { id: "tag-casa", name: "Casa Fixa", color: "#0284C7" },
    { id: "tag-trabalho", name: "Trabalho", color: "#27C6A0" }
];

const monthNamesPT = {
    "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
    "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
    "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
};

document.addEventListener("DOMContentLoaded", () => {
    const loginScreen = document.getElementById("login-screen");
    const appLayout = document.getElementById("app-layout");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const authSubtitle = document.getElementById("auth-subtitle");

    // Alternar Login / Cadastro por E-mail
    document.getElementById("show-register-btn").addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
        document.getElementById("toggle-to-register-box").classList.add("hidden");
        document.getElementById("toggle-to-login-box").classList.remove("hidden");
        authSubtitle.textContent = "Crie sua conta no ContaPay";
    });

    document.getElementById("show-login-btn").addEventListener("click", (e) => {
        e.preventDefault();
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        document.getElementById("toggle-to-login-box").classList.add("hidden");
        document.getElementById("toggle-to-register-box").classList.remove("hidden");
        authSubtitle.textContent = "Organize. Controle. Simplifique.";
    });

    // Redimensionar foto de perfil
    function processAvatar(inputEl, previewEl, callback) {
        const file = inputEl.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 150;
                canvas.height = 150;
                canvas.getContext("2d").drawImage(img, 0, 0, 150, 150);
                const compressed = canvas.toDataURL("image/jpeg", 0.8);
                previewEl.src = compressed;
                callback(compressed);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    let regAvatarData = document.getElementById("reg-avatar-preview").src;
    let editAvatarData = "";

    document.getElementById("reg-avatar-input").addEventListener("change", function () {
        processAvatar(this, document.getElementById("reg-avatar-preview"), (data) => regAvatarData = data);
    });

    document.getElementById("edit-avatar-input").addEventListener("change", function () {
        processAvatar(this, document.getElementById("edit-avatar-preview"), (data) => editAvatarData = data);
    });

    // ================= AUTENTICAÇÃO FIREBASE =================
    // 1. Login Oficial com Conta Google
    document.getElementById("google-login-btn").addEventListener("click", async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (error) {
            alert("Erro ao entrar com Google: " + error.message);
        }
    });

    // 2. Cadastro com E-mail e Senha no Firebase
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;

        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: name });
            await db.collection("users").doc(cred.user.uid).set({
                name,
                email,
                avatar: regAvatarData
            }, { merge: true });
        } catch (error) {
            alert("Erro ao criar conta: " + error.message);
        }
    });

    // 3. Login com E-mail e Senha no Firebase
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            alert("E-mail ou senha inválidos: " + error.message);
        }
    });

    // Observador de Sessão (Carrega dados da nuvem ao logar)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDocRef = db.collection("users").doc(user.uid);
            const userSnap = await userDocRef.get();
            const savedProfile = userSnap.exists ? userSnap.data() : {};

            currentUser = {
                uid: user.uid,
                name: savedProfile.name || user.displayName || "Usuário",
                email: user.email,
                avatar: savedProfile.avatar || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "ContaPay")}&background=102D50&color=27C6A0`
            };

            if (!userSnap.exists) {
                await userDocRef.set({
                    name: currentUser.name,
                    email: currentUser.email,
                    avatar: currentUser.avatar
                });
            }

            document.getElementById("user-display-name").textContent = currentUser.name.split(" ")[0];
            document.getElementById("header-avatar").src = currentUser.avatar;

            loginScreen.classList.add("hidden");
            appLayout.classList.remove("hidden");

            populateReportMonthOptions();
            await loadCloudData();
        } else {
            currentUser = null;
            userTransactions = [];
            userTags = [];
            appLayout.classList.add("hidden");
            loginScreen.classList.remove("hidden");
        }
    });

    // Navegação Sidebar
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => {
            switchPage(btn.dataset.page);
            document.getElementById("sidebar").classList.remove("open");
        });
    });

    document.getElementById("mobile-menu-btn").addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });

    document.getElementById("btn-nova-despesa-side").addEventListener("click", () => openTransactionModal("despesa"));
    document.getElementById("btn-nova-receita-side").addEventListener("click", () => openTransactionModal("receita"));

    // Seletor Moderno de Mês no Topo
    const globalMonthSelect = document.getElementById("global-month-select");
    const globalYearSelect = document.getElementById("global-year-select");

    function syncTopMonthWithReport() {
        const m = globalMonthSelect.value;
        const y = globalYearSelect.value;
        globalYearSelect.style.display = m === "todos" ? "none" : "inline-block";

        const reportMonthSelect = document.getElementById("filter-month");
        if (m === "todos") {
            reportMonthSelect.value = "todos";
        } else {
            const targetVal = `${y}-${m}`;
            if ([...reportMonthSelect.options].some(opt => opt.value === targetVal)) {
                reportMonthSelect.value = targetVal;
            }
        }
        renderAll();
    }

    globalMonthSelect.addEventListener("change", syncTopMonthWithReport);
    globalYearSelect.addEventListener("change", syncTopMonthWithReport);

    // Criar Nova Etiqueta na Nuvem
    document.getElementById("tag-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const nameInput = document.getElementById("new-tag-name");
        const colorInput = document.getElementById("new-tag-color");
        const name = nameInput.value.trim();
        if (!name) return;

        if (userTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            alert("Já existe uma etiqueta com esse nome!");
            return;
        }

        const tagId = "tag-" + Date.now();
        const newTag = { id: tagId, name, color: colorInput.value };
        await db.collection("users").doc(currentUser.uid).collection("tags").doc(tagId).set(newTag);

        userTags.push(newTag);
        nameInput.value = "";
        renderTags();
        renderAll();
    });

    // Filtros do Relatório e Exportação PDF
    ["filter-month", "filter-tag", "filter-type", "filter-status"].forEach(id => {
        document.getElementById(id).addEventListener("change", renderReportPreview);
    });

    document.getElementById("btn-export-pdf").addEventListener("click", generatePDFReport);

    // Criar ou Editar Lançamento na Nuvem
    const txModal = document.getElementById("tx-modal");
    document.getElementById("close-tx-modal").addEventListener("click", () => txModal.classList.add("hidden"));

    document.getElementById("tx-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const editId = document.getElementById("tx-id").value;
        const docId = editId ? String(editId) : String(Date.now());

        const payload = {
            id: docId,
            type: document.getElementById("tx-type").value,
            title: document.getElementById("tx-title").value.trim(),
            amount: parseFloat(document.getElementById("tx-amount").value),
            date: document.getElementById("tx-date").value,
            tag: document.getElementById("tx-tag").value || "Geral",
            category: document.getElementById("tx-category").value,
            payment: document.getElementById("tx-payment").value,
            status: document.getElementById("tx-status").value
        };

        await db.collection("users").doc(currentUser.uid).collection("transactions").doc(docId).set(payload);

        if (editId) {
            const idx = userTransactions.findIndex(item => String(item.id) === docId);
            if (idx !== -1) userTransactions[idx] = payload;
        } else {
            userTransactions.push(payload);
        }

        txModal.classList.add("hidden");
        e.target.reset();
        document.getElementById("tx-id").value = "";
        populateReportMonthOptions();
        renderAll();
    });

    // Perfil e Vinculação de Senha (para poder entrar com E-mail/Senha além do Google)
    const profileModal = document.getElementById("profile-modal");
    document.getElementById("open-profile-btn").addEventListener("click", () => {
        if (!currentUser) return;
        document.getElementById("edit-name").value = currentUser.name;
        document.getElementById("edit-email").value = currentUser.email;
        document.getElementById("edit-password").value = "";
        document.getElementById("edit-avatar-preview").src = currentUser.avatar;
        editAvatarData = currentUser.avatar;
        profileModal.classList.remove("hidden");
    });

    document.getElementById("close-profile-btn").addEventListener("click", () => profileModal.classList.add("hidden"));

    document.getElementById("profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        currentUser.name = document.getElementById("edit-name").value.trim();
        currentUser.avatar = editAvatarData;

        await db.collection("users").doc(currentUser.uid).set({
            name: currentUser.name,
            email: currentUser.email,
            avatar: currentUser.avatar
        }, { merge: true });

        const newPass = document.getElementById("edit-password").value;
        if (newPass && auth.currentUser) {
            if (newPass.length < 6) {
                alert("A senha deve ter pelo menos 6 caracteres.");
                return;
            }
            try {
                const hasPasswordProvider = auth.currentUser.providerData.some(p => p.providerId === "password");
                if (hasPasswordProvider) {
                    await auth.currentUser.updatePassword(newPass);
                } else {
                    const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, newPass);
                    await auth.currentUser.linkWithCredential(cred);
                }
                alert("Perfil e senha salvos! Agora você também pode entrar digitando seu e-mail e senha.");
            } catch (err) {
                alert("Perfil salvo, mas para cadastrar/alterar a senha, saia e entre novamente com o Google antes de definir a senha.");
            }
        }

        document.getElementById("user-display-name").textContent = currentUser.name.split(" ")[0];
        document.getElementById("header-avatar").src = currentUser.avatar;
        profileModal.classList.add("hidden");
    });

    // Tema e Logout
    document.getElementById("theme-toggle").addEventListener("click", function () {
        document.body.classList.toggle("dark-theme");
        this.textContent = document.body.classList.contains("dark-theme") ? "☀️" : "🌙";
    });

    document.getElementById("logout-btn").addEventListener("click", async () => {
        await auth.signOut();
    });
});

// ================= CARREGAMENTO DA NUVEM (FIRESTORE) =================
async function loadCloudData() {
    if (!currentUser) return;
    const userRef = db.collection("users").doc(currentUser.uid);

    // Carregar Etiquetas
    const tagsSnap = await userRef.collection("tags").get();
    if (tagsSnap.empty) {
        for (const t of defaultTags) {
            await userRef.collection("tags").doc(t.id).set(t);
        }
        userTags = [...defaultTags];
    } else {
        userTags = tagsSnap.docs.map(doc => doc.data());
    }

    // Carregar Lançamentos
    const txSnap = await userRef.collection("transactions").get();
    userTransactions = txSnap.docs.map(doc => doc.data());

    renderTags();
    renderAll();
}

function getTransactions() {
    return [...userTransactions].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

// ================= AUXILIARES DE PERÍODO =================
function getSelectedPeriodYYYYMM() {
    const m = document.getElementById("global-month-select").value;
    const y = document.getElementById("global-year-select").value;
    return m === "todos" ? "" : `${y}-${m}`;
}

function populateReportMonthOptions() {
    const select = document.getElementById("filter-month");
    const currentVal = select.value || "2026-11";
    const years = ["2025", "2026", "2027"];

    let html = `<option value="todos">Todos os meses</option>`;
    years.forEach(yr => {
        Object.keys(monthNamesPT).forEach(mKey => {
            html += `<option value="${yr}-${mKey}">${monthNamesPT[mKey]} / ${yr}</option>`;
        });
    });
    select.innerHTML = html;
    select.value = currentVal;
}

// ================= ETIQUETAS (TAGS) =================
async function deleteTag(tagId) {
    if (!currentUser) return;
    if (userTags.length <= 1) {
        alert("Mantenha pelo menos uma etiqueta cadastrada.");
        return;
    }
    await db.collection("users").doc(currentUser.uid).collection("tags").doc(tagId).delete();
    userTags = userTags.filter(t => t.id !== tagId);
    renderTags();
    renderAll();
}

function getTagBadgeHTML(tagName) {
    const found = userTags.find(t => t.name === tagName);
    const color = found ? found.color : "#64748B";
    return `<span class="tag-badge-table" style="background-color: ${color};">${tagName || "Geral"}</span>`;
}

function renderTags() {
    const container = document.getElementById("tags-list-container");
    container.innerHTML = userTags.map(t => `
        <span class="tag-pill" style="background-color: ${t.color};">
            🏷️ ${t.name}
            <button type="button" onclick="deleteTag('${t.id}')" title="Remover etiqueta">×</button>
        </span>
    `).join("");

    const filterSelect = document.getElementById("filter-tag");
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = `<option value="todas">Todas as etiquetas</option>` +
        userTags.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
    if (userTags.some(t => t.name === currentFilter)) filterSelect.value = currentFilter;

    const txTagSelect = document.getElementById("tx-tag");
    txTagSelect.innerHTML = userTags.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
}

// ================= TRANSAÇÕES, EDIÇÃO E TABELAS =================
function formatBRL(val) {
    return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateStr) {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

function switchPage(pageName) {
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === pageName);
    });
    document.querySelectorAll(".page-content").forEach(sec => sec.classList.add("hidden"));
    document.getElementById(`page-${pageName}`).classList.remove("hidden");
    if (pageName === "relatorios") renderReportPreview();
}

function openTransactionModal(type) {
    renderTags();
    document.getElementById("tx-form").reset();
    document.getElementById("tx-id").value = "";
    document.getElementById("tx-type").value = type;
    document.getElementById("tx-modal-title").textContent = type === "despesa" ? "Nova Conta a Pagar (Despesa)" : "Nova Conta a Receber (Receita)";
    document.getElementById("tx-date").valueAsDate = new Date();
    document.getElementById("tx-modal").classList.remove("hidden");
}

function editTransaction(id) {
    const item = userTransactions.find(t => String(t.id) === String(id));
    if (!item) return;

    renderTags();
    document.getElementById("tx-id").value = item.id;
    document.getElementById("tx-type").value = item.type;
    document.getElementById("tx-title").value = item.title;
    document.getElementById("tx-amount").value = item.amount;
    document.getElementById("tx-date").value = item.date;
    document.getElementById("tx-tag").value = item.tag || "Geral";
    document.getElementById("tx-category").value = item.category;
    document.getElementById("tx-payment").value = item.payment;
    document.getElementById("tx-status").value = item.status;

    document.getElementById("tx-modal-title").textContent = item.type === "despesa" ? "Editar Conta a Pagar" : "Editar Conta a Receber";
    document.getElementById("tx-modal").classList.remove("hidden");
}

async function toggleStatus(id) {
    if (!currentUser) return;
    const item = userTransactions.find(t => String(t.id) === String(id));
    if (item) {
        item.status = item.status === "Pago" ? "Pendente" : "Pago";
        await db.collection("users").doc(currentUser.uid).collection("transactions").doc(String(id)).update({
            status: item.status
        });
        renderAll();
    }
}

async function deleteTransaction(id) {
    if (!currentUser || !confirm("Deseja excluir este lançamento?")) return;
    await db.collection("users").doc(currentUser.uid).collection("transactions").doc(String(id)).delete();
    userTransactions = userTransactions.filter(t => String(t.id) !== String(id));
    renderAll();
}

function renderAll() {
    const selectedMonth = getSelectedPeriodYYYYMM();
    const m = document.getElementById("global-month-select").value;
    const y = document.getElementById("global-year-select").value;

    document.getElementById("kpi-period-label").textContent = m === "todos"
        ? "Todos os períodos"
        : `${monthNamesPT[m]}/${y}`;

    const allList = getTransactions();
    const list = selectedMonth
        ? allList.filter(t => t.date && t.date.startsWith(selectedMonth))
        : allList;

    const despesas = list.filter(t => t.type === "despesa");
    const receitas = list.filter(t => t.type === "receita");

    const totalReceitas = receitas.reduce((acc, t) => acc + t.amount, 0);
    const totalDespesas = despesas.reduce((acc, t) => acc + t.amount, 0);
    const totalPendentes = list.filter(t => t.status === "Pendente").reduce((acc, t) => acc + t.amount, 0);

    document.getElementById("kpi-saldo").textContent = formatBRL(totalReceitas - totalDespesas);
    document.getElementById("kpi-receitas").textContent = formatBRL(totalReceitas);
    document.getElementById("kpi-despesas").textContent = formatBRL(totalDespesas);
    document.getElementById("kpi-pendentes").textContent = formatBRL(totalPendentes);

    // Home
    document.getElementById("home-pagar-tbody").innerHTML = despesas.length
        ? despesas.slice(0, 5).map(t => `
            <tr>
                <td>${formatDateBR(t.date)}</td>
                <td><strong>${t.title}</strong></td>
                <td>${getTagBadgeHTML(t.tag)}</td>
                <td class="text-red">${formatBRL(t.amount)}</td>
                <td><span class="badge ${t.status === 'Pago' ? 'badge-pago' : 'badge-pendente'}">${t.status}</span></td>
            </tr>
        `).join("")
        : `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Nenhuma conta a pagar neste período.</td></tr>`;

    document.getElementById("home-receber-tbody").innerHTML = receitas.length
        ? receitas.slice(0, 5).map(t => `
            <tr>
                <td>${formatDateBR(t.date)}</td>
                <td><strong>${t.title}</strong></td>
                <td>${getTagBadgeHTML(t.tag)}</td>
                <td class="text-green">${formatBRL(t.amount)}</td>
                <td><span class="badge ${t.status === 'Pago' ? 'badge-pago' : 'badge-pendente'}">${t.status === 'Pago' ? 'Recebido' : 'Pendente'}</span></td>
            </tr>
        `).join("")
        : `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Nenhuma conta a receber neste período.</td></tr>`;

    // Contas a Pagar
    document.getElementById("full-pagar-tbody").innerHTML = despesas.length
        ? despesas.map(t => `
            <tr>
                <td>${formatDateBR(t.date)}</td>
                <td><strong>${t.title}</strong></td>
                <td>${getTagBadgeHTML(t.tag)}</td>
                <td>${t.category}</td>
                <td>${t.payment}</td>
                <td class="text-red"><strong>${formatBRL(t.amount)}</strong></td>
                <td><span class="badge ${t.status === 'Pago' ? 'badge-pago' : 'badge-pendente'}">${t.status}</span></td>
                <td>
                    <button class="btn-action-sm" onclick="editTransaction('${t.id}')" title="Editar">✏️</button>
                    <button class="btn-action-sm" onclick="toggleStatus('${t.id}')">${t.status === 'Pago' ? 'Reabrir' : 'Dar Baixa'}</button>
                    <button class="btn-action-sm" onclick="deleteTransaction('${t.id}')" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="8" style="text-align:center; padding:18px; color:var(--text-secondary);">Nenhuma despesa encontrada para este mês.</td></tr>`;

    // Contas a Receber
    document.getElementById("full-receber-tbody").innerHTML = receitas.length
        ? receitas.map(t => `
            <tr>
                <td>${formatDateBR(t.date)}</td>
                <td><strong>${t.title}</strong></td>
                <td>${getTagBadgeHTML(t.tag)}</td>
                <td>${t.category}</td>
                <td>${t.payment}</td>
                <td class="text-green"><strong>${formatBRL(t.amount)}</strong></td>
                <td><span class="badge ${t.status === 'Pago' ? 'badge-pago' : 'badge-pendente'}">${t.status === 'Pago' ? 'Recebido' : 'Pendente'}</span></td>
                <td>
                    <button class="btn-action-sm" onclick="editTransaction('${t.id}')" title="Editar">✏️</button>
                    <button class="btn-action-sm" onclick="toggleStatus('${t.id}')">${t.status === 'Pago' ? 'Reabrir' : 'Confirmar'}</button>
                    <button class="btn-action-sm" onclick="deleteTransaction('${t.id}')" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="8" style="text-align:center; padding:18px; color:var(--text-secondary);">Nenhuma receita encontrada para este mês.</td></tr>`;

    renderReportPreview();
}

// ================= FILTRO E EXPORTAÇÃO PDF =================
function getFilteredTransactions() {
    const monthFilter = document.getElementById("filter-month").value;
    const tagFilter = document.getElementById("filter-tag").value;
    const typeFilter = document.getElementById("filter-type").value;
    const statusFilter = document.getElementById("filter-status").value;

    return getTransactions().filter(t => {
        const matchMonth = monthFilter === "todos" || (t.date && t.date.startsWith(monthFilter));
        const matchTag = tagFilter === "todas" || (t.tag || "Geral") === tagFilter;
        const matchType = typeFilter === "todos" || t.type === typeFilter;
        const matchStatus = statusFilter === "todos" || t.status === statusFilter;
        return matchMonth && matchTag && matchType && matchStatus;
    });
}

function renderReportPreview() {
    const filtered = getFilteredTransactions();

    const rec = filtered.filter(t => t.type === "receita").reduce((acc, t) => acc + t.amount, 0);
    const desp = filtered.filter(t => t.type === "despesa").reduce((acc, t) => acc + t.amount, 0);

    document.getElementById("rep-receitas").textContent = formatBRL(rec);
    document.getElementById("rep-despesas").textContent = formatBRL(desp);
    document.getElementById("rep-saldo").textContent = formatBRL(rec - desp);

    const tbody = document.getElementById("report-tbody");
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhum lançamento encontrado para este mês/filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td>${formatDateBR(t.date)}</td>
            <td>${t.type === 'receita' ? 'Receita' : 'Despesa'}</td>
            <td><strong>${t.title}</strong></td>
            <td>${getTagBadgeHTML(t.tag)}</td>
            <td>${t.category}</td>
            <td>${t.status === 'Pago' && t.type === 'receita' ? 'Recebido' : t.status}</td>
            <td class="${t.type === 'receita' ? 'text-green' : 'text-red'}"><strong>${formatBRL(t.amount)}</strong></td>
        </tr>
    `).join("");
}

async function generatePDFReport() {
    const filtered = getFilteredTransactions();
    if (filtered.length === 0) {
        alert("Não há dados neste mês/filtro para gerar o PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const monthSelected = document.getElementById("filter-month").value;
    const tagSelected = document.getElementById("filter-tag").value;
    const userName = currentUser ? currentUser.name : "Usuário";

    let periodoLabel = "Todos os Meses";
    if (monthSelected !== "todos") {
        const [yr, mo] = monthSelected.split("-");
        periodoLabel = `${monthNamesPT[mo]}/${yr}`;
    }

    doc.setFillColor(16, 45, 80);
    doc.rect(0, 0, 210, 32, "F");

    let titleStartX = 14;
    try {
        const logoBase64 = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext("2d").drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = reject;
            img.src = "logo.png";
        });

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 5, 14, 14, 2, 2, "F");
        doc.addImage(logoBase64, "PNG", 15, 6, 12, 12);
        titleStartX = 32;
    } catch (e) {}

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("ContaPay", titleStartX, 15);

    doc.setFontSize(10);
    doc.setTextColor(39, 198, 160);
    const filtroTexto = tagSelected === "todas" ? "Todas as Etiquetas" : `Etiqueta: ${tagSelected}`;
    doc.text(`Período: ${periodoLabel}  |  ${filtroTexto}  |  Usuário: ${userName}`, 14, 26);

    const rec = filtered.filter(t => t.type === "receita").reduce((acc, t) => acc + t.amount, 0);
    const desp = filtered.filter(t => t.type === "despesa").reduce((acc, t) => acc + t.amount, 0);
    const saldo = rec - desp;

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text(`Total Receitas: ${formatBRL(rec)}     |     Total Despesas: ${formatBRL(desp)}     |     Saldo: ${formatBRL(saldo)}`, 14, 42);

    const rows = filtered.map(t => [
        formatDateBR(t.date),
        t.type === "receita" ? "Receita" : "Despesa",
        t.title,
        t.tag || "Geral",
        t.category,
        t.status === "Pago" && t.type === "receita" ? "Recebido" : t.status,
        formatBRL(t.amount)
    ]);

    doc.autoTable({
        startY: 48,
        head: [["Data", "Tipo", "Descrição", "Etiqueta", "Categoria", "Situação", "Valor"]],
        body: rows,
        headStyles: { fillColor: [16, 45, 80], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [243, 245, 248] },
        styles: { fontSize: 9 }
    });

    const nomeArquivo = `Relatorio_ContaPay_${periodoLabel.replace("/", "_")}.pdf`;
    doc.save(nomeArquivo);
}