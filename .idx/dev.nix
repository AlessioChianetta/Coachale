{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
  ];
  idx = {
    extensions = [
      "svelte.svelte-vscode"
      "vue.volar"
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          # Qui forziamo la porta 5000
          command = [
            "npm"
            "run"
            "dev"
            "--"
            "--port"
            "5000"
            "--host"
            "0.0.0.0"
          ];
          manager = "web";
          # Diciamo all'ambiente che la PORT è 5000
          env = {
            PORT = "5000";
          };
        };
      };
    };
  };
}