export function initHome(enter) {
  const page = document.getElementById("homePage");
  const frames = [...page.querySelectorAll(".knight-frame")];
  const button = document.getElementById("drawSword");
  const order = [2, 1, 0, 3, 4, 5];
  const timing = [380, 420, 440, 440, 420, 650];
  let timer, generation = 0, ready;
  function frame(index) {
    frames.forEach((image, i) => image.classList.toggle("is-active", i === index));
    page.dataset.pose = String(index + 1);
  }
  function prepare() {
    ready ??= Promise.all(frames.map(async (image) => {
      if (!image.src) image.src = image.dataset.src;
      try { await image.decode(); } catch { /* Direct entry remains available. */ }
    }));
    return ready;
  }
  function reset() {
    generation++;
    clearTimeout(timer);
    page.classList.remove("drawing", "crowned");
    button.disabled = false;
    button.textContent = "Draw the sword";
    frame(order[0]);
  }
  button.onclick = async () => {
    const current = ++generation;
    button.disabled = true;
    button.textContent = "Drawing the sword…";
    await prepare();
    if (current !== generation) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      enter();
      return;
    }
    page.classList.add("drawing");
    let step = 0;
    const advance = () => {
      if (current !== generation) return;
      if (step === order.length) { enter(); return; }
      frame(order[step]);
      if (step >= 4) page.classList.add("crowned");
      timer = setTimeout(advance, timing[step++]);
    };
    advance();
  };
  return {
    show() { reset(); prepare(); },
    hide() { reset(); },
  };
}
