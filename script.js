const startButton = document.getElementById("startCamera");
const video = document.getElementById("camera");

startButton.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        }
      },
      audio: false
    });

    video.srcObject = stream;

  } catch (error) {
    console.error("Camera error:", error);
    alert("Camera tidak bisa diakses.");
  }
});
