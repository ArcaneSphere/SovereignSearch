export function createReadMe() {
  const el = document.createElement('div');
  el.className = "manager-page readme-document";

  el.innerHTML = `
  <h2>Readme</h2>

  <h3>Nodes</h3>

  <p>
    For the best experience you run your own local node. With a local node most TELA dApp and Site browsing will be fast and instantaneous. <br>
    When using a remote node expect less speed when browsing, but it still works.<br>
    Software to run your own local node you will find here:<br>
    <a href="https://github.com/deroproject/derohe/releases">https://github.com/deroproject/derohe/releases</a>
  </p>
  `;
  return el;
}

