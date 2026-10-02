import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm";

const startCameraButton = document.getElementById("startCamera");
const startTrackingButton = document.getElementById("startTracking");

const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status");

let poseLandmarker = null;
let drawingUtils = null;

let currentStream = null;
let tracking = false;
let lastVideoTime = -1;


// =======================================
// 1. START CAMERA
// =======================================

startCameraButton.addEventListener("click", async () => {

  try {

    statusText.innerText = "Status: starting camera...";

    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          exact: "environment"
        }
      },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;

    await video.play();

    statusText.innerText = "Status: camera ready";

  } catch (error) {

    console.error("Camera error:", error);

    statusText.innerText = "Status: camera error";

    alert(
      "Kamera belakang tidak bisa diakses. Error: " +
      error.name
    );
  }
});


// =======================================
// 2. LOAD MEDIAPIPE
// =======================================

async function initializePoseLandmarker() {

  statusText.innerText = "Status: loading MediaPipe...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },

      runningMode: "VIDEO",

      numPoses: 1,

      minPoseDetectionConfidence: 0.5,

      minPosePresenceConfidence: 0.5,

      minTrackingConfidence: 0.5
    }
  );

  drawingUtils = new DrawingUtils(ctx);

  statusText.innerText = "Status: MediaPipe ready";
}


// =======================================
// 3. START POSE TRACKING
// =======================================

startTrackingButton.addEventListener("click", async () => {

  if (!video.srcObject) {

    alert("Start Camera dulu.");

    return;
  }

  if (!poseLandmarker) {

    try {

      await initializePoseLandmarker();

    } catch (error) {

      console.error("MediaPipe error:", error);

      statusText.innerText =
        "Status: MediaPipe failed to load";

      alert("MediaPipe gagal dimuat.");

      return;
    }
  }

  tracking = true;

  statusText.innerText =
    "Status: tracking pose";

  predictWebcam();
});


// =======================================
// 4. READ VIDEO FRAME
// =======================================

async function predictWebcam() {

  if (!tracking) {
    return;
  }

  if (
    video.readyState < 2 ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {

    requestAnimationFrame(predictWebcam);

    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  if (video.currentTime !== lastVideoTime) {

    lastVideoTime = video.currentTime;

    const timestamp = performance.now();

    const result =
      poseLandmarker.detectForVideo(
        video,
        timestamp
      );

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (
      result.landmarks &&
      result.landmarks.length > 0
    ) {

      for (
        const landmarks of result.landmarks
      ) {

        drawingUtils.drawConnectors(
          landmarks,
          PoseLandmarker.POSE_CONNECTIONS,
          {
            lineWidth: 3
          }
        );

        drawingUtils.drawLandmarks(
          landmarks,
          {
            radius: 4
          }
        );
      }

      statusText.innerText =
        "Status: body detected";

    } else {

      statusText.innerText =
        "Status: searching for body...";
    }
  }

  requestAnimationFrame(predictWebcam);
}
