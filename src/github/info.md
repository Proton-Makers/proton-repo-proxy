## 📦 Les principaux packages npm pour GitHub Actions

- **`@actions/core`**
  - Sert à gérer les *inputs*, *outputs*, logs et erreurs.
  - Fonctions utiles : `core.getInput()`, `core.setOutput()`, `core.setFailed()`, `core.info()`.
  - Exemple :
    ```ts
    import * as core from "@actions/core";

    const name = core.getInput("name");
    core.setOutput("greeting", `Hello ${name}`);
    ```

- **`@actions/github`**
  - Fournit un client Octokit déjà configuré pour appeler l’API GitHub.
  - Permet de créer des issues, commenter des PRs, lire des commits, etc.
  - Exemple :
    ```ts
    import * as core from "@actions/core";
    import * as github from "@actions/github";

    const token = core.getInput("token");
    const octokit = github.getOctokit(token);

    await octokit.rest.issues.create({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      title: "Automated issue",
    });
    ```

- **`@actions/exec`**
  - Pour exécuter des commandes shell de manière contrôlée (stdout/stderr capturés).
  - Exemple :
    ```ts
    import { exec } from "@actions/exec";

    await exec("echo", ["Hello from exec"]);
    ```

- **`@actions/io`**
  - Pour manipuler des fichiers et dossiers (copier, déplacer, créer).
  - Exemple :
    ```ts
    import * as io from "@actions/io";

    await io.mkdirP("dist");
    ```

- **`@actions/cache`**
  - Pour mettre en cache des dépendances (npm, pnpm, yarn, etc.) entre les runs.
  - Très utile pour accélérer les workflows.

---

## 🚀 Bonnes pratiques

- **Toujours utiliser `@actions/core`** pour communiquer avec le workflow (inputs/outputs).
- **Utiliser `@actions/github`** si tu as besoin d’interagir avec l’API GitHub.
- **Limiter les dépendances** : ces packages sont pensés pour être légers et fiables dans l’environnement GitHub Actions.
- **TypeScript recommandé** : tous ces packages ont des types intégrés, ce qui rend le développement plus sûr et lisible.

---
