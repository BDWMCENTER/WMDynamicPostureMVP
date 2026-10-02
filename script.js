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
let lastTime = -1;

// ==========================
// CAMERA
// ==========================

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
    status.textContent = "Status: camera error - " + error.name;
  }
});

// ==========================
// MEDIAPIPE
// ==========================

async function loadPoseLandmarker() {
  status.textContent = "Status: loading pose model...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(
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

  drawingUtils = new DrawingUtils(ctx);

  status.textContent = "Status: MediaPipe ready";
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

    status.textContent = "Status: tracking";

    requestAnimationFrame(trackPose);

  } catch (error) {
    console.error(error);
    status.textContent = "Status: MediaPipe error";
    alert(error.message);
  }
});

// ==========================
// ANGLE FUNCTION
// ==========================

function calculateAngle(a, b, c) {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x);

  let angle = Math.abs(radians * 180 / Math.PI);

  if (angle > 180) {
    angle = 360 - angle;
  }

  return angle;
}

// ==========================
// TRACKING
// ==========================

function trackPose() {
  if (!poseLandmarker) return;

  if (
    video.readyState >= 2 &&
    video.currentTime !== lastTime
  ) {
    lastTime = video.currentTime;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const result = poseLandmarker.detectForVideo(
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
      const landmarks = result.landmarks[0];

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

      // MediaPipe landmark indices
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];

      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];

      const leftAnkle = landmarks[27];
      const rightAnkle = landmarks[28];

      // Geometric angles
      const leftGeometricAngle = calculateAngle(
        leftHip,
        leftKnee,
        leftAnkle
      );

      const rightGeometricAngle = calculateAngle(
        rightHip,
        rightKnee,
        rightAnkle
      );

      // Convert to clinical flexion angle
      const leftKneeFlexion =
        180 - leftGeometricAngle;

      const rightKneeFlexion =
        180 - rightGeometricAngle;

      // Left-right difference
      const kneeDifference =
        Math.abs(
          leftKneeFlexion -
          rightKneeFlexion
        );

      // Update display
      document.getElementById("leftKnee").textContent =
        leftKneeFlexion.toFixed(1) + "°";

      document.getElementById("rightKnee").textContent =
        rightKneeFlexion.toFixed(1) + "°";

      document.getElementById("kneeDifference").textContent =
        kneeDifference.toFixed(1) + "°";

      status.textContent = "Status: body detected";

    } else {
      status.textContent = "Status: searching body";
    }
  }

  requestAnimationFrame(trackPose);
}
