const menuButton = document.querySelector(".menu-toggle");
const menu = document.querySelector("#menu");

if (menuButton && menu) {
  menuButton.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  menu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      menu.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

const storageKeys = {
  adminEmail: "gelcipAdminEmail",
  submissions: "gelcipCourseSubmissions"
};

const adminEmailInput = document.querySelector("#admin-email");
const saveAdminButton = document.querySelector("[data-save-admin]");
const adminNote = document.querySelector("[data-admin-note]");
const courseForm = document.querySelector(".course-form");
const courseNote = document.querySelector("[data-course-note]");
const totalSubmissions = document.querySelector("[data-total-submissions]");
const submissionsList = document.querySelector("[data-submissions-list]");
const downloadCsvButton = document.querySelector("[data-download-csv]");
const emailLastButton = document.querySelector("[data-email-last]");
const emailAllButton = document.querySelector("[data-email-all]");
const clearSubmissionsButton = document.querySelector("[data-clear-submissions]");

const getSubmissions = () => {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.submissions) || "[]");
  } catch {
    return [];
  }
};

const saveSubmissions = (submissions) => {
  localStorage.setItem(storageKeys.submissions, JSON.stringify(submissions));
};

const getAdminEmail = () => {
  return localStorage.getItem(storageKeys.adminEmail) || "contato@gelcip.com";
};

const setNote = (element, message) => {
  if (element) {
    element.textContent = message;
  }
};

const formatSubmission = (submission) => {
  return [
    `Curso: ${submission.curso}`,
    `Nome: ${submission.nome}`,
    `E-mail: ${submission.email}`,
    `Telefone: ${submission.telefone || "Não informado"}`,
    `Período: ${submission.periodo || "Sem preferência"}`,
    `Observações: ${submission.observacoes || "Nenhuma"}`,
    `Data: ${submission.data}`
  ].join("\n");
};

const openEmail = (subject, body) => {
  const mailto = new URL(`mailto:${getAdminEmail()}`);
  mailto.searchParams.set("subject", subject);
  mailto.searchParams.set("body", body);
  window.location.href = mailto.toString();
};

const escapeCsv = (value) => {
  const text = String(value || "");
  return `"${text.replaceAll('"', '""')}"`;
};

const createSubmissionFromForm = (form) => {
  const data = new FormData(form);
  return {
    curso: String(data.get("curso") || "").trim(),
    nome: String(data.get("nome") || "").trim(),
    email: String(data.get("email") || "").trim(),
    telefone: String(data.get("telefone") || "").trim(),
    periodo: String(data.get("periodo") || "").trim(),
    observacoes: String(data.get("observacoes") || "").trim(),
    data: new Date().toLocaleString("pt-BR")
  };
};

const renderSubmissions = () => {
  const submissions = getSubmissions();

  if (totalSubmissions) {
    totalSubmissions.textContent = String(submissions.length);
  }

  if (!submissionsList) {
    return;
  }

  submissionsList.innerHTML = "";

  if (submissions.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhuma inscrição registrada ainda.";
    submissionsList.append(item);
    return;
  }

  submissions.slice(-8).reverse().forEach((submission) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    const details = document.createElement("span");

    name.textContent = submission.nome;
    details.textContent = `${submission.curso} - ${submission.email}`;
    item.append(name, details);
    submissionsList.append(item);
  });
};

if (adminEmailInput) {
  adminEmailInput.value = getAdminEmail();
}

if (saveAdminButton && adminEmailInput) {
  saveAdminButton.addEventListener("click", () => {
    const email = adminEmailInput.value.trim();

    if (!email || !email.includes("@")) {
      setNote(adminNote, "Informe um e-mail válido para o administrador.");
      return;
    }

    localStorage.setItem(storageKeys.adminEmail, email);
    setNote(adminNote, `E-mail do administrador salvo: ${email}`);
  });
}

if (courseForm) {
  courseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const submission = createSubmissionFromForm(courseForm);

    if (!submission.curso || !submission.nome || !submission.email) {
      setNote(courseNote, "Preencha curso, nome e e-mail para enviar a inscrição.");
      return;
    }

    const submissions = getSubmissions();
    submissions.push(submission);
    saveSubmissions(submissions);
    renderSubmissions();
    courseForm.reset();

    if (courseForm.classList.contains("public-course-form")) {
      openEmail(`Inscrição de curso - ${submission.nome}`, formatSubmission(submission));
      setNote(courseNote, "Sua inscrição foi preparada para envio por e-mail ao GELCIP.");
      return;
    }

    setNote(courseNote, "Inscrição salva nesta área administrativa.");
  });
}

if (emailLastButton) {
  emailLastButton.addEventListener("click", () => {
    const submissions = getSubmissions();
    const last = submissions[submissions.length - 1];

    if (!last) {
      setNote(courseNote, "Salve uma inscrição antes de enviar por e-mail.");
      return;
    }

    openEmail(`Inscrição de curso - ${last.nome}`, formatSubmission(last));
  });
}

if (emailAllButton) {
  emailAllButton.addEventListener("click", () => {
    const submissions = getSubmissions();

    if (submissions.length === 0) {
      setNote(courseNote, "Não há inscrições para enviar.");
      return;
    }

    const body = submissions.map(formatSubmission).join("\n\n---\n\n");
    openEmail("Lista de inscrições de cursos - GELCIP", body);
  });
}

if (downloadCsvButton) {
  downloadCsvButton.addEventListener("click", () => {
    const submissions = getSubmissions();

    if (submissions.length === 0) {
      setNote(courseNote, "Não há inscrições para baixar.");
      return;
    }

    const headers = ["data", "curso", "nome", "email", "telefone", "periodo", "observacoes"];
    const rows = submissions.map((submission) => headers.map((field) => escapeCsv(submission[field])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "inscricoes-gelcip.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    setNote(courseNote, "Arquivo CSV gerado com sucesso.");
  });
}

if (clearSubmissionsButton) {
  clearSubmissionsButton.addEventListener("click", () => {
    saveSubmissions([]);
    renderSubmissions();
    setNote(courseNote, "Lista local de inscrições limpa.");
  });
}

const formButton = document.querySelector("[data-local-form]");
const contactForm = document.querySelector(".contact-form");
const contactFormNote = document.querySelector(".contact-form .form-note");

if (formButton && contactForm && contactFormNote) {
  formButton.addEventListener("click", () => {
    const data = new FormData(contactForm);
    const nome = String(data.get("nome") || "").trim();
    const email = String(data.get("email") || "").trim();
    const mensagem = String(data.get("mensagem") || "").trim();
    const body = [
      nome ? `Nome: ${nome}` : "",
      email ? `E-mail: ${email}` : "",
      "",
      mensagem
    ].filter(Boolean).join("\n");

    openEmail("Contato pelo site do GELCIP", body || "Olá, gostaria de entrar em contato com o GELCIP.");
    contactFormNote.textContent = "Seu aplicativo de e-mail foi aberto com a mensagem preenchida.";
  });
}

renderSubmissions();
