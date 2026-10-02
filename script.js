const startButton = document.getElementById("startCamera");
const video = document.getElementById("camera");

let currentStream = null;

startButton.addEventListener("click", async () => {
  try {
    // Matikan stream lama kalau ada
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    // Paksa kamera belakang
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

  } catch (error) {
    console.error("Camera error:", error);

    alert(
      "Kamera belakang tidak bisa dipilih otomatis. Error: " +
      error.name
    );
  }
});
