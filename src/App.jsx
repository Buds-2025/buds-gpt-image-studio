import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import ControlPanel from "./components/ControlPanel";
import ResultPanel from "./components/ResultPanel";
import {
  kieUploadFile,
  kieImportUrl,
  kieCreateTask,
  kieTaskInfo,
  apimartCreateTask,
  apimartTaskInfo,
  readFileAsBase64,
  createDbTask,
  updateDbTask,
  recordDbEvent,
  sleep,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
  MODEL_VARIANTS,
} from "./services/api";

const DEFAULT_PROMPT =
  "极简静物摄影，温润自然光影，通透色彩层次，8K超清。";

export default function App() {
  const [provider, setProvider] = useState(() => localStorage.getItem("image_provider") || "kie");
  const [kieApiKey, setKieApiKey] = useState(() => localStorage.getItem("kie_api_key") || "");
  const [apiMartApiKey, setApiMartApiKey] = useState(() => localStorage.getItem("apimart_api_key") || "");
  const [modelVariant, setModelVariant] = useState(
    () => localStorage.getItem("gpt_image_model_variant") || "flare"
  );
  const [mode, setMode] = useState("text"); // 'text' | 'multi' | 'batch'
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [images, setImages] = useState([]);
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [resolution, setResolution] = useState("1K");
  const [generationCount, setGenerationCount] = useState(1);
  const [batchConcurrency, setBatchConcurrency] = useState(3);

  const [tasks, setTasks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeApiKey = provider === "apimart" ? apiMartApiKey : kieApiKey;

  const [theme, setTheme] = useState(() => localStorage.getItem("studio_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("studio_theme", theme);
  }, [theme]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("image_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("kie_api_key", kieApiKey);
  }, [kieApiKey]);

  useEffect(() => {
    localStorage.setItem("apimart_api_key", apiMartApiKey);
  }, [apiMartApiKey]);

  useEffect(() => {
    localStorage.setItem("gpt_image_model_variant", modelVariant);
  }, [modelVariant]);

  // Update a task in React state
  const patchTask = (taskId, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  };

  // Helper to prepare reference image URLs
  const prepareReferenceUrls = async (items, localTaskId, taskProvider, taskApiKey) => {
    if (taskProvider === "apimart") {
      // APIMart: convert local files to Base64 data URLs, keep URLs as is
      return Promise.all(
        items.map(async (item) => {
          if (item.kind === "file") {
            return await readFileAsBase64(item.file);
          }
          return item.remoteUrl;
        })
      );
    } else {
      // KIE: upload files to KIE file storage, import remote URLs
      return Promise.all(
        items.map(async (item) => {
          if (item.kind === "file") {
            patchTask(localTaskId, { activeStep: `上传参考图: ${item.name}` });
            return await kieUploadFile(item.file, taskApiKey);
          } else {
            patchTask(localTaskId, { activeStep: `转存参考图: ${item.name}` });
            return await kieImportUrl(item.remoteUrl, taskApiKey);
          }
        })
      );
    }
  };

  // Poll task execution with isolated provider and API key
  const pollTask = async (localTaskId, remoteTaskId, taskProvider, taskApiKey) => {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);

      const info =
        taskProvider === "apimart"
          ? await apimartTaskInfo(taskApiKey, remoteTaskId)
          : await kieTaskInfo(taskApiKey, remoteTaskId);

      if (info.state === "success") {
        patchTask(localTaskId, {
          status: "success",
          resultUrls: info.resultUrls,
          activeStep: "生成成功",
          finishedAt: Date.now(),
        });
        await updateDbTask(localTaskId, {
          status: "success",
          result_urls: info.resultUrls,
          active_step: "生成成功",
          finished_at: Date.now(),
        });
        await recordDbEvent(localTaskId, {
          phase: "poll-finish",
          level: "info",
          message: `任务已完成，输出 ${info.resultUrls?.length || 0} 张图片`,
        });
        return info;
      }

      if (info.state === "fail") {
        const errorMsg = info.failMsg || info.failCode || "远程生成端返回失败";
        patchTask(localTaskId, {
          status: "fail",
          error: errorMsg,
          failCode: info.failCode,
          activeStep: "生成失败",
          finishedAt: Date.now(),
        });
        await updateDbTask(localTaskId, {
          status: "fail",
          error_message: errorMsg,
          fail_code: info.failCode || "",
          fail_msg: info.failMsg || "",
          finished_at: Date.now(),
        });
        await recordDbEvent(localTaskId, {
          phase: "poll-fail",
          level: "error",
          message: errorMsg,
        });
        throw new Error(errorMsg);
      }

      patchTask(localTaskId, {
        status: "waiting",
        activeStep: `AI 渲染中 (已查询 ${i + 1} 次)...`,
      });
    }

    throw new Error("轮询超时：上游任务仍在队列或计算中，您可稍后输入任务 ID 进行调取。");
  };

  // Run a single task lifecycle with full parameter isolation
  const executeSingleTask = async (taskSeed, referenceItems = []) => {
    const localTaskId = taskSeed.id;
    const taskProvider = taskSeed.provider || provider;
    const taskApiKey = taskProvider === "apimart" ? apiMartApiKey : kieApiKey;
    const taskModelVariant = taskSeed.modelVariant || taskSeed.model || modelVariant;
    const taskAspectRatio = taskSeed.aspectRatio || taskSeed.aspect_ratio || aspectRatio;
    const taskResolution = taskSeed.resolution || resolution;
    const actualRefItems =
      referenceItems && referenceItems.length > 0
        ? referenceItems
        : taskSeed.referenceItems || (taskSeed.refImage ? [taskSeed.refImage] : []);

    try {
      // 1. Prepare images
      let inputUrls = [];
      if (actualRefItems.length > 0) {
        patchTask(localTaskId, { status: "uploading", activeStep: "准备参考图像..." });
        inputUrls = await prepareReferenceUrls(actualRefItems, localTaskId, taskProvider, taskApiKey);
      }

      // 2. Create upstream task
      patchTask(localTaskId, { status: "creating", activeStep: "提交到计算集群..." });
      const createRes =
        taskProvider === "apimart"
          ? await apimartCreateTask({
              apiKey: taskApiKey,
              prompt: taskSeed.prompt,
              modelVariant: taskModelVariant,
              inputUrls,
              aspectRatio: taskAspectRatio,
              resolution: taskResolution,
            })
          : await kieCreateTask({
              apiKey: taskApiKey,
              prompt: taskSeed.prompt,
              modelVariant: taskModelVariant,
              inputUrls,
              aspectRatio: taskAspectRatio,
              resolution: taskResolution,
            });

      const remoteTaskId = createRes.taskId;
      patchTask(localTaskId, {
        taskId: remoteTaskId,
        model: createRes.model,
        status: "waiting",
        activeStep: "任务已受理，等待出图...",
      });

      await updateDbTask(localTaskId, {
        status: "waiting",
        remote_task_id: remoteTaskId,
        model: createRes.model,
        active_step: "远程任务已受理",
      });

      // 3. Poll for result with isolated provider and key
      await pollTask(localTaskId, remoteTaskId, taskProvider, taskApiKey);
    } catch (err) {
      patchTask(localTaskId, {
        status: "fail",
        error: err.message || "任务执行异常",
        activeStep: "执行失败",
      });
      await updateDbTask(localTaskId, {
        status: "fail",
        error_message: err.message,
        finished_at: Date.now(),
      });
    }
  };

  // Run with concurrency worker
  const runConcurrentPool = async (taskList, concurrency, workerFn) => {
    const queue = [...taskList];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) await workerFn(item);
      }
    });
    await Promise.all(workers);
  };

  // Main generate handler
  const handleGenerate = async () => {
    if (!activeApiKey?.trim()) {
      setErrorMessage(`请先在顶部填写 ${provider === "apimart" ? "API Mart" : "KIE.ai"} 的 API Key`);
      return;
    }
    if (!prompt.trim()) {
      setErrorMessage("请输入生成提示词");
      return;
    }
    if (mode !== "text" && images.length === 0) {
      setErrorMessage("当前图生图模式需要至少上传或指定 1 张参考图");
      return;
    }

    if (provider === "kie" && (resolution === "2K" || resolution === "4K")) {
      const unsupported = ["5:4", "4:5", "3:1", "1:3", "9:21"];
      if (unsupported.includes(aspectRatio)) {
        setErrorMessage(`KIE 通道在 ${resolution} 分辨率下不支持 ${aspectRatio} 比例，请选择 1K 或改选常用比例（如 16:9、9:16、3:2、1:1 等）。`);
        return;
      }
    }

    setErrorMessage("");
    setIsGenerating(true);

    try {
      if (mode === "text") {
        // Text-to-image: create N tasks
        const newTasks = [];
        for (let i = 0; i < generationCount; i++) {
          const id = `IMG-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
          const initialRecord = {
            id,
            title: generationCount > 1 ? `文生图 · 方案 ${i + 1}` : "文生图任务",
            mode: "text",
            provider,
            model: modelVariant,
            modelVariant,
            status: "queued",
            prompt: prompt.trim(),
            aspectRatio,
            aspect_ratio: aspectRatio,
            resolution,
            inputPreviews: [],
            input_previews: [],
            resultUrls: [],
            retryCount: 0,
            activeStep: "排队中",
            referenceItems: [],
          };
          newTasks.push(initialRecord);
          createDbTask(initialRecord);
        }
        setTasks((prev) => [...newTasks, ...prev]);

        await runConcurrentPool(newTasks, 4, async (seed) => {
          await executeSingleTask(seed, []);
        });
      } else if (mode === "multi") {
        // Multi-image reference: merged into N tasks
        const newTasks = [];
        const previews = images.map((img) => img.previewUrl);
        for (let i = 0; i < generationCount; i++) {
          const id = `IMG-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
          const initialRecord = {
            id,
            title: generationCount > 1 ? `多图参考 · 方案 ${i + 1}` : "多图参考任务",
            mode: "multi",
            provider,
            model: modelVariant,
            modelVariant,
            status: "queued",
            prompt: prompt.trim(),
            aspectRatio,
            aspect_ratio: aspectRatio,
            resolution,
            inputPreviews: previews,
            input_previews: previews,
            resultUrls: [],
            retryCount: 0,
            activeStep: "准备中",
            referenceItems: [...images],
          };
          newTasks.push(initialRecord);
          createDbTask(initialRecord);
        }
        setTasks((prev) => [...newTasks, ...prev]);

        await runConcurrentPool(newTasks, 4, async (seed) => {
          await executeSingleTask(seed, images);
        });
      } else {
        // Batch mode: 1 task per reference image
        const newTasks = images.map((img, i) => {
          const id = `IMG-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
          const initialRecord = {
            id,
            title: `批量重绘 · ${img.name}`,
            sourceName: img.name,
            mode: "batch",
            provider,
            model: modelVariant,
            modelVariant,
            status: "queued",
            prompt: prompt.trim(),
            aspectRatio,
            aspect_ratio: aspectRatio,
            resolution,
            inputPreviews: [img.previewUrl],
            input_previews: [img.previewUrl],
            resultUrls: [],
            retryCount: 0,
            activeStep: "排队中",
            referenceItems: [img],
            refImage: img,
          };
          createDbTask(initialRecord);
          return { seed: initialRecord, refImage: img };
        });

        setTasks((prev) => [...newTasks.map((t) => t.seed), ...prev]);

        await runConcurrentPool(newTasks, batchConcurrency, async ({ seed, refImage }) => {
          await executeSingleTask(seed, [refImage]);
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isGenerating) {
          handleGenerate();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, activeApiKey, prompt, mode, images, generationCount, batchConcurrency]);

  // Retry a failed task with faithful reference items and parameters
  const handleRetryTask = (task) => {
    const updated = {
      ...task,
      status: "queued",
      retryCount: (task.retryCount || 0) + 1,
      activeStep: "正在重新提交...",
    };
    patchTask(task.id, updated);
    const retryRefItems =
      task.referenceItems && task.referenceItems.length > 0
        ? task.referenceItems
        : task.refImage
        ? [task.refImage]
        : images.length > 0
        ? images
        : [];
    executeSingleTask(updated, retryRefItems);
  };

  return (
    <div className="studio-root-container">
      <Header
        provider={provider}
        setProvider={setProvider}
        kieApiKey={kieApiKey}
        setKieApiKey={setKieApiKey}
        apiMartApiKey={apiMartApiKey}
        setApiMartApiKey={setApiMartApiKey}
        modelVariant={modelVariant}
        theme={theme}
        setTheme={setTheme}
      />

      <main className="studio-workbench-layout">
        <ControlPanel
          provider={provider}
          modelVariant={modelVariant}
          setModelVariant={setModelVariant}
          mode={mode}
          setMode={setMode}
          prompt={prompt}
          setPrompt={setPrompt}
          images={images}
          setImages={setImages}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          resolution={resolution}
          setResolution={setResolution}
          generationCount={generationCount}
          setGenerationCount={setGenerationCount}
          batchConcurrency={batchConcurrency}
          setBatchConcurrency={setBatchConcurrency}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
        />

        <ResultPanel
          tasks={tasks}
          onRetryTask={handleRetryTask}
          provider={provider}
        />
      </main>
    </div>
  );
}
