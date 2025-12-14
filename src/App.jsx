// src/App.jsx
import { useState } from "react";
import "./App.css";

import Shell from "./components/Shell";
import useUpdateBanner from "./hooks/useUpdateBanner";
import useMicDevices from "./hooks/useMicDevices";

import Home from "./pages/Home";
import LiveCoach from "./pages/LiveCoach";
import Recorder from "./pages/Recorder";
import Roleplay from "./pages/Roleplay";

function App() {
  // Views
  const [view, setView] = useState("home"); // home | live | record | roleplay

  // Status light
  const [status, setStatus] = useState("Idle");

  // Update banner
  const updateBanner = useUpdateBanner();

  // Shared mic devices
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    permissionState,
    ensureMicPermission,
    loadDevices,
  } = useMicDevices();

  // light on if anything “active”
  const activeLight = status !== "Idle";

  return (
    <Shell status={status} activeLight={activeLight} updateBanner={updateBanner}>
      {view === "home" && <Home setView={setView} />}

      {view === "live" && (
        <LiveCoach
          setView={setView}
          setStatus={setStatus}
          permissionState={permissionState}
          ensureMicPermission={ensureMicPermission}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          loadDevices={loadDevices}
        />
      )}

      {view === "record" && (
        <Recorder
          setView={setView}
          setStatus={setStatus}
          permissionState={permissionState}
          ensureMicPermission={ensureMicPermission}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          loadDevices={loadDevices}
        />
      )}

      {view === "roleplay" && (
        <Roleplay
          setView={setView}
          setStatus={setStatus}
          permissionState={permissionState}
          ensureMicPermission={ensureMicPermission}
        />
      )}
    </Shell>
  );
}

export default App;
