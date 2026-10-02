import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm";

const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const startCamera = document.getElementById("startCamera");
const startTracking = document.getElementById("startTracking");
const status = document.getElementById("status");

let poseLandmarker;
let drawingUtils;
let stream;

startCamera.addEventListener("click", async () => {

  try {

    status.textContent = "Status: opening camera...";

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          exact: "environment"
        }
      },
      audio: false
    });

    video.srcObject = stream;

    await video.play();

    status.textContent = "Status: camera ready";

  } catch (error) {

    console.error(error);

    status.textContent =
      "Status: camera error - " + error.name;
  }
});


async function loadPoseLandmarker() {

  status.textContent =
    "Status: loading pose model...";

  const vision =
    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

  poseLandmarker =
    await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        },

        runningMode: "VIDEO",

        numPoses: 1
      }
    );

  drawingUtils =
    new DrawingUtils(ctx);

  status.textContent =
    "Status: MediaPipe ready";
}


startTracking.addEventListener("click", async () => {

  if (!video.srcObject) {

    alert("Start Camera dulu.");

    return;
  }

  try {

    if (!poseLandmarker) {
      await loadPoseLandmarker();
    }

    status.textContent =
      "Status: tracking";

    requestAnimationFrame(trackPose);

  } catch (error) {

    console.error(error);

    status.textContent =
      "Status: MediaPipe error";

    alert(error.message);
  }
});


let lastTime = -1;

function trackPose() {

  if (!poseLandmarker) return;

  if (
    video.readyState >= 2 &&
    video.currentTime !== lastTime
  ) {

    lastTime = video.currentTime;

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const result =
      poseLandmarker.detectForVideo(
        video,
        performance.now()
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

      const landmarks =
        result.landmarks[0];

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

      status.textContent =
        "Status: body detected";

    } else {

      status.textContent =
        "Status: searching body";
    }
  }

  requestAnimationFrame(trackPose);
}
