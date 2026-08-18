// ============================================================
// MAYORISTA EMANUEL — reposicion.js
// Abre el Panel de Reposición (GitHub Pages) dentro de un modal
// ============================================================

(function () {
  const REPO_URL = "https://daniel1234749.github.io/cobertura-emanuel/";

  const btnAbrir   = document.getElementById("btnReposicion");
  const modal      = document.getElementById("modalReposicion");
  const btnCerrar  = document.getElementById("btnCerrarReposicion");
  const iframe     = document.getElementById("iframeReposicion");
  const loading    = document.getElementById("repoLoading");

  if (!btnAbrir || !modal) return; // por si el HTML todavía no se agregó

  function abrir() {
    // Cache-busting: agregamos un parámetro que cambia siempre, para forzar
    // que el navegador pida la última versión y no reuse una copia en caché.
    iframe.src = REPO_URL + "?t=" + Date.now();
    loading.style.display = "flex";
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function cerrar() {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }

  iframe.addEventListener("load", () => {
    loading.style.display = "none";
  });

  btnAbrir.addEventListener("click", abrir);
  btnCerrar.addEventListener("click", cerrar);

  // Cerrar al hacer click fuera del contenido
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrar();
  });

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") cerrar();
  });
})();