// Configuração da API - atualizar após deploy do backend
const API_BASE = 'https://2y7jhhwf19.execute-api.us-east-2.amazonaws.com/prod';

// Menu toggle
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

// Utilitário para exibir mensagens nos formulários
const setNote = (element, message, isError = false) => {
  if (element) {
    element.textContent = message;
    element.style.color = isError ? '#c0392b' : '';
  }
};

// Formulário de inscrição em cursos
const courseForm = document.querySelector(".public-course-form");
const courseNote = document.querySelector("[data-course-note]");

if (courseForm) {
  courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(courseForm);
    const payload = {
      curso: String(data.get("curso") || "").trim(),
      nome: String(data.get("nome") || "").trim(),
      email: String(data.get("email") || "").trim(),
      telefone: String(data.get("telefone") || "").trim(),
      periodo: String(data.get("periodo") || "").trim(),
      observacoes: String(data.get("observacoes") || "").trim(),
    };

    if (!payload.curso || !payload.nome || !payload.email) {
      setNote(courseNote, "Preencha curso, nome e e-mail para enviar a inscrição.", true);
      return;
    }

    const submitButton = courseForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Enviando...";
    }

    try {
      const response = await fetch(`${API_BASE}/inscricao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setNote(courseNote, "✓ Inscrição enviada com sucesso! O GELCIP entrará em contato.");
        courseForm.reset();
      } else {
        setNote(courseNote, result.error || "Erro ao enviar inscrição. Tente novamente.", true);
      }
    } catch (err) {
      setNote(courseNote, "Erro de conexão. Verifique sua internet e tente novamente.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Enviar inscrição";
      }
    }
  });
}

// Formulário de contato
const contactForm = document.querySelector(".contact-form");
const contactFormNote = document.querySelector(".contact-form .form-note");
const contactButton = document.querySelector("[data-local-form]");

if (contactButton && contactForm && contactFormNote) {
  contactButton.addEventListener("click", async () => {
    const data = new FormData(contactForm);
    const payload = {
      nome: String(data.get("nome") || "").trim(),
      email: String(data.get("email") || "").trim(),
      mensagem: String(data.get("mensagem") || "").trim(),
    };

    if (!payload.nome || !payload.email || !payload.mensagem) {
      setNote(contactFormNote, "Preencha todos os campos para enviar.", true);
      return;
    }

    contactButton.disabled = true;
    contactButton.textContent = "Enviando...";

    try {
      const response = await fetch(`${API_BASE}/contato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setNote(contactFormNote, "✓ Mensagem enviada com sucesso! Obrigado pelo contato.");
        contactForm.reset();
      } else {
        setNote(contactFormNote, result.error || "Erro ao enviar mensagem. Tente novamente.", true);
      }
    } catch (err) {
      setNote(contactFormNote, "Erro de conexão. Verifique sua internet e tente novamente.", true);
    } finally {
      contactButton.disabled = false;
      contactButton.textContent = "Enviar mensagem";
    }
  });
}
