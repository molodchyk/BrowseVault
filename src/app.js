import { startBrowseVaultApp } from "./features/app-shell/ui/bootstrap.js";

startBrowseVaultApp({ document })
  .catch((error) => {
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = error.message;
    }
  });
