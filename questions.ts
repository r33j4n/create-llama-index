import ciInfo from "ci-info";
import { blue, green } from "picocolors";
import prompts from "prompts";
import { InstallAppArgs } from "./create-app";
import { COMMUNITY_OWNER, COMMUNITY_REPO } from "./helpers/constant";
import { getRepoRootFolders } from "./helpers/repo";

export type QuestionArgs = Omit<InstallAppArgs, "appPath" | "packageManager">;

const defaults: QuestionArgs = {
  template: "streaming",
  framework: "nextjs",
  engine: "simple",
  ui: "html",
  eslint: true,
  frontend: false,
  openAiKey: "",
  model: "gpt-3.5-turbo",
  communityProjectPath: "",
};

const handlers = {
  onCancel: () => {
    console.error("Exiting.");
    process.exit(1);
  },
};

export const onPromptState = (state: any) => {
  if (state.aborted) {
    // If we don't re-enable the terminal cursor before exiting
    // the program, the cursor will remain hidden
    process.stdout.write("\x1B[?25h");
    process.stdout.write("\n");
    process.exit(1);
  }
};

export const askQuestions = async (
  program: QuestionArgs,
  preferences: QuestionArgs,
) => {
  const getPrefOrDefault = <K extends keyof QuestionArgs>(
    field: K,
  ): QuestionArgs[K] => preferences[field] ?? defaults[field];

  if (!program.template) {
    if (ciInfo.isCI) {
      program.template = getPrefOrDefault("template");
    } else {
      const styledRepo = blue(
        `https://github.com/${COMMUNITY_OWNER}/${COMMUNITY_REPO}`,
      );
      const { template } = await prompts(
        {
          type: "select",
          name: "template",
          message: "Which template would you like to use?",
          choices: [
            { title: "Chat without streaming", value: "simple" },
            { title: "Chat with streaming", value: "streaming" },
            {
              title: `Community template from ${styledRepo}`,
              value: "community",
            },
          ],
          initial: 1,
        },
        handlers,
      );
      program.template = template;
      preferences.template = template;
    }
  }

  if (program.template === "community") {
    const rootFolderNames = await getRepoRootFolders(
      COMMUNITY_OWNER,
      COMMUNITY_REPO,
    );
    const { communityProjectPath } = await prompts(
      {
        type: "select",
        name: "communityProjectPath",
        message: "Select community template",
        choices: rootFolderNames.map((name) => ({
          title: name,
          value: name,
        })),
        initial: 0,
      },
      {
        onCancel: () => {
          console.error("Exiting.");
          process.exit(1);
        },
      },
    );

    program.communityProjectPath = communityProjectPath;
    preferences.communityProjectPath = communityProjectPath;
    return; // early return - no further questions needed for community projects
  }

  if (!program.framework) {
    if (ciInfo.isCI) {
      program.framework = getPrefOrDefault("framework");
    } else {
      const choices = [
        { title: "Express", value: "express" },
        { title: "FastAPI (Python)", value: "fastapi" },
      ];
      if (program.template === "streaming") {
        // allow NextJS only for streaming template
        choices.unshift({ title: "NextJS", value: "nextjs" });
      }

      const { framework } = await prompts(
        {
          type: "select",
          name: "framework",
          message: "Which framework would you like to use?",
          choices,
          initial: 0,
        },
        handlers,
      );
      program.framework = framework;
      preferences.framework = framework;
    }
  }

  if (program.framework === "express" || program.framework === "fastapi") {
    if (process.argv.includes("--no-frontend")) {
      program.frontend = false;
    }
    // if a backend-only framework is selected, ask whether we should create a frontend
    if (program.frontend === undefined) {
      if (ciInfo.isCI) {
        program.frontend = getPrefOrDefault("frontend");
      } else {
        const styledNextJS = blue("NextJS");
        const styledBackend = green(
          program.framework === "express"
            ? "Express "
            : program.framework === "fastapi"
              ? "FastAPI (Python) "
              : "",
        );
        const { frontend } = await prompts({
          onState: onPromptState,
          type: "toggle",
          name: "frontend",
          message: `Would you like to generate a ${styledNextJS} frontend for your ${styledBackend}backend?`,
          initial: getPrefOrDefault("frontend"),
          active: "Yes",
          inactive: "No",
        });
        program.frontend = Boolean(frontend);
        preferences.frontend = Boolean(frontend);
      }
    }
  } else {
    // single project if framework is nextjs
    program.frontend = false;
  }

  if (program.framework === "nextjs" || program.frontend) {
    if (!program.ui) {
      if (ciInfo.isCI) {
        program.ui = getPrefOrDefault("ui");
      } else {
        const { ui } = await prompts(
          {
            type: "select",
            name: "ui",
            message: "Which UI would you like to use?",
            choices: [
              { title: "Just HTML", value: "html" },
              { title: "Shadcn", value: "shadcn" },
            ],
            initial: 0,
          },
          handlers,
        );
        program.ui = ui;
        preferences.ui = ui;
      }
    }
  }

  if (program.framework === "express" || program.framework === "nextjs") {
    if (!program.model) {
      if (ciInfo.isCI) {
        program.model = getPrefOrDefault("model");
      } else {
        const { model } = await prompts(
          {
            type: "select",
            name: "model",
            message: "Which model would you like to use?",
            choices: [
              { title: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
              { title: "gpt-4", value: "gpt-4" },
              { title: "gpt-4-1106-preview", value: "gpt-4-1106-preview" },
              {
                title: "gpt-4-vision-preview",
                value: "gpt-4-vision-preview",
              },
            ],
            initial: 0,
          },
          handlers,
        );
        program.model = model;
        preferences.model = model;
      }
    }
  }

  if (program.framework === "express" || program.framework === "nextjs") {
    if (!program.engine) {
      if (ciInfo.isCI) {
        program.engine = getPrefOrDefault("engine");
      } else {
        const { engine } = await prompts(
          {
            type: "select",
            name: "engine",
            message: "Which chat engine would you like to use?",
            choices: [
              { title: "ContextChatEngine", value: "context" },
              {
                title: "SimpleChatEngine (no data, just chat)",
                value: "simple",
              },
            ],
            initial: 0,
          },
          handlers,
        );
        program.engine = engine;
        preferences.engine = engine;
      }
    }
  }

  if (!program.openAiKey) {
    const { key } = await prompts(
      {
        type: "text",
        name: "key",
        message: "Please provide your OpenAI API key (leave blank to skip):",
      },
      handlers,
    );
    program.openAiKey = key;
    preferences.openAiKey = key;
  }

  if (
    program.framework !== "fastapi" &&
    !process.argv.includes("--eslint") &&
    !process.argv.includes("--no-eslint")
  ) {
    if (ciInfo.isCI) {
      program.eslint = getPrefOrDefault("eslint");
    } else {
      const styledEslint = blue("ESLint");
      const { eslint } = await prompts({
        onState: onPromptState,
        type: "toggle",
        name: "eslint",
        message: `Would you like to use ${styledEslint}?`,
        initial: getPrefOrDefault("eslint"),
        active: "Yes",
        inactive: "No",
      });
      program.eslint = Boolean(eslint);
      preferences.eslint = Boolean(eslint);
    }
  }

  // TODO: consider using zod to validate the input (doesn't work like this as not every option is required)
  // templateUISchema.parse(program.ui);
  // templateEngineSchema.parse(program.engine);
  // templateFrameworkSchema.parse(program.framework);
  // templateTypeSchema.parse(program.template);``
};