document.querySelectorAll(".toggle-row button").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
