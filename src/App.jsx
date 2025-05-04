import React, { useState, useEffect, useCallback } from "react";
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Badge,
  Spinner,
  useToast,
  Tooltip,
  IconButton,
  Progress,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // Define constant
const STATUS_CHECK_INTERVAL_MS = 30000; // Check status every 30 seconds

// --- ADD REVERSE MAP START ---
const friendlyToShortNameMap = {
  localdev: "localdev",
  "aws-master": "master",
  // Add mapping for dev-new if its friendly name is known
  // 'some-dev-new-friendly-name': 'dev-new'
};
// --- ADD REVERSE MAP END ---

// --- ADD DESCRIPTIONS MAP START ---
const envDescriptions = {
  localdev: "Local development environment",
  master: "environment (aws-master)",
  "dev-new": "New staging/feature environment (Lens)",
};
// --- ADD DESCRIPTIONS MAP END ---

// Helper function to format milliseconds into H:M:S
const formatElapsedTime = (ms) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`); // Show seconds if less than a minute or exactly 0
  return parts.join(" ");
};

// --- MODIFY PARSER START ---
// Updated parser to use friendlyToShortNameMap and return map keyed by SHORT name
const parseKaftStatus = (output) => {
  const appsList = []; // Keep original list for potential future use
  const statusByShortName = {}; // Map keyed by short name (e.g., 'master')
  if (!output) return { appsList, appsMap: statusByShortName };

  const lineRegex = /\|\s*([\w-]+)\s*\|\s*(\d+)\s*\|\s*([\w\s]+)\s*\|/g;
  let match;

  while ((match = lineRegex.exec(output)) !== null) {
    const friendlyName = match[1].trim();
    const expiresAt = match[2].trim();
    const remaining = match[3].trim();

    if (
      friendlyName &&
      friendlyName !== "APP" &&
      !friendlyName.startsWith("---")
    ) {
      const appData = { name: friendlyName, expiresAt, remaining }; // Store friendly name inside data
      appsList.push(appData);

      // Find the corresponding short name
      const shortName = friendlyToShortNameMap[friendlyName];
      if (shortName) {
        statusByShortName[shortName] = appData;
      } else {
        // Handle cases where friendly name is not in the map
        console.warn(
          `[App Parse Status] Friendly name "${friendlyName}" not found in friendlyToShortNameMap. Using it directly as key.`
        );
        statusByShortName[friendlyName] = appData; // Fallback: use friendly name as key
      }
    }
  }
  console.log("[App Parse Status] Parsed apps list:", appsList);
  console.log(
    "[App Parse Status] Status map keyed by short name:",
    statusByShortName
  );
  return { appsList, appsMap: statusByShortName }; // Return map keyed by short name
};
// --- MODIFY PARSER END ---

// --- ADD TOOLTIP HELPER START ---
const generateTooltipText = (appsStatus) => {
  const baseText = "Auto Kaft";
  if (!appsStatus || typeof appsStatus !== "object") {
    return `${baseText} - Status Unknown`;
  }
  const activeEnvs = Object.entries(appsStatus)
    .filter(([key, value]) => value && value.name) // Check if the environment has data (is active in status)
    .map(([key, value]) => value.name); // Get the friendly name from status data

  if (activeEnvs.length > 0) {
    return `${baseText} - Active: ${activeEnvs.join(", ")}`;
  } else {
    return `${baseText} - Idle`;
  }
};
// --- ADD TOOLTIP HELPER END ---

function App() {
  // UI Timer state (when was 'kaft env' clicked)
  const [activeTimers, setActiveTimers] = useState(() => {
    // Load timers from localStorage on initial render
    const savedTimers = localStorage.getItem("activeTimers");
    if (savedTimers) {
      try {
        const parsedTimers = JSON.parse(savedTimers);
        const now = Date.now();
        return Object.entries(parsedTimers).reduce((acc, [env, startTime]) => {
          if (
            startTime &&
            typeof startTime === "number" &&
            now - startTime < FOUR_HOURS_MS
          ) {
            acc[env] = startTime;
          } else if (startTime) {
            console.warn(
              `Invalid startTime found for ${env} in localStorage:`,
              startTime
            );
          }
          return acc;
        }, {});
      } catch (e) {
        console.error(
          "Failed to parse activeTimers from localStorage, clearing data:",
          e
        );
        localStorage.removeItem("activeTimers"); // Clear corrupted data
        return {};
      }
    }
    return {};
  });

  // State for mapping command env name to friendly name from status output
  const [envNameMapping, setEnvNameMapping] = useState(() => {
    const saved = localStorage.getItem("envNameMapping");
    return saved ? JSON.parse(saved) : {};
    // Add error handling as before if needed
  });

  // State for actual status fetched from 'kaft status' command
  const [kaftStatusData, setKaftStatusData] = useState({
    loading: true,
    apps: {},
    error: null,
  });

  // --- ADD DEBUG STATE START ---
  const [rawStatusOutput, setRawStatusOutput] = useState(null);
  const [parsedStatusMap, setParsedStatusMap] = useState(null);
  // --- ADD DEBUG STATE END ---

  // State to force re-renders for elapsed time updates
  const [, setTick] = useState(0);
  const toast = useToast();

  // Save timers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("activeTimers", JSON.stringify(activeTimers));
  }, [activeTimers]);

  // Save mapping state to localStorage
  useEffect(() => {
    localStorage.setItem("envNameMapping", JSON.stringify(envNameMapping));
  }, [envNameMapping]);

  // Effect for updating elapsed UI time display only
  useEffect(() => {
    const interval = setInterval(() => {
      const activeEnvs = Object.keys(activeTimers);
      let changed = false;
      const now = Date.now();
      const updatedTimers = { ...activeTimers };

      activeEnvs.forEach((env) => {
        if (now - updatedTimers[env] >= FOUR_HOURS_MS) {
          console.log(
            `UI timer expired for ${env}, removing from activeTimers state.`
          );
          delete updatedTimers[env];
          changed = true;
        }
      });

      if (changed) {
        setActiveTimers(updatedTimers);
      } else if (activeEnvs.length > 0) {
        // Only tick if there are active UI timers
        setTick((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers]);

  // Updated function to fetch and update status (uses appsMap from parser)
  const fetchAndUpdateKaftStatus = useCallback(async () => {
    console.log("[App Fetch Status] Fetching kaft status...");
    setKaftStatusData((prev) => ({ ...prev, loading: true, error: null }));
    setRawStatusOutput(null); // Clear debug info
    setParsedStatusMap(null); // Clear debug info
    try {
      const result = await window.electronAPI.checkStatus();
      console.log("[App Fetch Status] Result from checkStatus:", result);
      if (result.success) {
        const { appsMap } = parseKaftStatus(result.output);
        setKaftStatusData({ loading: false, apps: appsMap, error: null });
        // --- SET DEBUG STATE START ---
        setRawStatusOutput(result.output || "(No raw output received)");
        setParsedStatusMap(appsMap || "(Parsing resulted in null/undefined)");
        // --- SET DEBUG STATE END ---
      } else {
        console.error(
          "[App Fetch Status] checkStatus command failed:",
          result.error
        );
        setKaftStatusData({
          loading: false,
          apps: {},
          error: result.error || "Failed to execute kaft status",
        });
        toast({
          title: "Status Check Failed",
          description: result.error,
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error("[App Fetch Status] Error calling checkStatus IPC:", error);
      // --- CLEAR DEBUG STATE ON ERROR START ---
      setRawStatusOutput("(Error fetching status)");
      setParsedStatusMap(null);
      // --- CLEAR DEBUG STATE ON ERROR END ---
      setKaftStatusData({
        loading: false,
        apps: {},
        error: error.message || "IPC error",
      });
      toast({
        title: "Status Check IPC Error",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, []);

  // Fetch initial status on mount
  useEffect(() => {
    console.log(
      "[Effect Trigger] Mount effect running, calling fetchAndUpdateKaftStatus..."
    );
    fetchAndUpdateKaftStatus();
  }, [fetchAndUpdateKaftStatus]); // Depend on the memoized function

  // --- ADD TOOLTIP UPDATE EFFECT START ---
  useEffect(() => {
    const tooltipText = generateTooltipText(kaftStatusData.apps);
    console.log("[App Effect Tooltip] Generated tooltip text:", tooltipText);
    if (
      window.electronAPI &&
      typeof window.electronAPI.updateTooltip === "function"
    ) {
      window.electronAPI
        .updateTooltip(tooltipText)
        .then((result) => {
          if (!result.success) {
            console.warn(
              "[App Effect Tooltip] Main process failed to update tooltip:",
              result.error
            );
          }
        })
        .catch((error) => {
          console.error(
            "[App Effect Tooltip] Error sending tooltip update IPC:",
            error
          );
        });
    } else {
      console.warn(
        "[App Effect Tooltip] electronAPI.updateTooltip not available yet."
      );
    }
  }, [kaftStatusData.apps]); // Re-run whenever the status data changes
  // --- ADD TOOLTIP UPDATE EFFECT END ---

  // Updated handleCommandClick
  const handleCommandClick = async (env) => {
    console.log(`[App Handle Click] Button clicked for env: ${env}`);
    setKaftStatusData((prev) => ({ ...prev, loading: true, error: null })); // Set loading for this specific env

    try {
      console.log(
        `[App Handle Click] Calling electronAPI.executeCommand for ${env}`
      );
      const result = await window.electronAPI.executeCommand(env);
      console.log(
        `[App Handle Click] Result from executeCommand for ${env}:`,
        result
      );

      if (result.success) {
        toast({
          title: `Command '${env}' executed`,
          description: "Status might take a moment to update.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        // --- MODIFY TIMER START FOR DEV-NEW START ---
        // Start the UI timer *only* if the environment is NOT 'dev-new'
        if (env !== "dev-new") {
          const now = Date.now();
          setActiveTimers((prev) => ({ ...prev, [env]: now }));
          console.log(
            `[App Handle Click] UI timer started for ${env} at ${now}`
          );
        } else {
          console.log(
            `[App Handle Click] Skipping UI timer start for special env: ${env}`
          );
        }
        // --- MODIFY TIMER START FOR DEV-NEW END ---

        // --- Trigger status update after successful command ---
        setTimeout(fetchAndUpdateKaftStatus, 1500); // Add a small delay
      } else {
        toast({
          title: `Command '${env}' failed`,
          description: result.error || "Unknown error",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        console.error(
          `[App Handle Click] executeCommand failed for ${env}:`,
          result.error,
          result.stderr
        );
      }
    } catch (error) {
      toast({
        title: "IPC Error",
        description: `Failed to send command for ${env}: ${error.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      console.error(
        `[App Handle Click] IPC error calling executeCommand for ${env}:`,
        error
      );
    } finally {
      setKaftStatusData((prev) => ({ ...prev, loading: false })); // Clear loading for this env
    }
  };

  // Updated render control to use mapping and descriptions
  const renderEnvironmentControl = (env, colorScheme) => {
    const commandLoading = kaftStatusData.loading;
    const isTimerActive = !!activeTimers[env]; // UI timer state
    const kaftStatus = kaftStatusData.apps[env]; // Get status from kaft status check
    const description = envDescriptions[env] || "No description available.";

    // --- MODIFY STATUS DISPLAY LOGIC START ---
    // Determine real activity based on kaft status *only*.
    // The UI timer (isTimerActive) is now separate.
    const isKaftActive = !!kaftStatus; // Active if present in kaft status output

    // --- HIDE TIMER DISPLAY FOR DEV-NEW START ---
    // Determine if we should *display* the timer UI elements
    const shouldDisplayTimer = isTimerActive && env !== "dev-new";
    // --- HIDE TIMER DISPLAY FOR DEV-NEW END ---

    let remainingTimeStr = "";
    // --- ADD PROGRESS CALCULATION START ---
    let progressPercent = 0;
    // --- ADD PROGRESS CALCULATION END ---

    if (shouldDisplayTimer) {
      const startTime = activeTimers[env];
      const elapsed = Date.now() - startTime;
      const remainingMs = FOUR_HOURS_MS - elapsed;
      remainingTimeStr =
        remainingMs > 0 ? formatElapsedTime(remainingMs) : "Expired";
      // --- ADD PROGRESS CALCULATION START ---
      // Calculate progress percentage, ensuring it stays between 0 and 100
      progressPercent = Math.max(
        0,
        Math.min(100, (elapsed / FOUR_HOURS_MS) * 100)
      );
      // --- ADD PROGRESS CALCULATION END ---
    }

    // --- MODIFY STATUS DISPLAY LOGIC END ---

    return (
      <Box
        key={env}
        p={5}
        shadow="md"
        borderWidth="1px"
        borderRadius="md"
        w="100%"
        bg={`${colorScheme}.50`} // Use Chakra color scheme nuances
        opacity={commandLoading ? 0.7 : 1}
        position="relative" // Needed for absolute positioning of badge/spinner
      >
        <HStack justify="space-between" align="center">
          <HStack spacing={4} align="center">
            {/* Status Indicator */}
            <Box
              w="12px"
              h="12px"
              borderRadius="full"
              bg={isKaftActive ? "green.500" : "red.500"} // Status based on kaft status
              title={
                isKaftActive
                  ? "Active in 'kaft status'"
                  : "Inactive in 'kaft status'"
              }
            />
            {/* Command Info */}
            <VStack align="start" spacing={0}>
              <Text fontWeight="bold" fontSize="lg">
                kaft env {env}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {description}
              </Text>
            </VStack>
          </HStack>

          {/* Right Side: Timer/Status Badge/Button */}
          <VStack align="end" spacing={1} minW="160px">
            {" "}
            {/* Added minW for better alignment */}
            {/* --- MODIFY BADGE DISPLAY FOR DEV-NEW START --- */}
            {/* Show Active/Inactive badge only if NOT 'dev-new' OR if 'dev-new' and timer shouldn't be displayed */}
            {
              shouldDisplayTimer ? (
                <Badge colorScheme="green" variant="solid" alignSelf="flex-end">
                  ACTIVE
                </Badge>
              ) : env !== "dev-new" ? ( // Only show Inactive badge for non-dev-new envs
                <Badge colorScheme="red" variant="outline" alignSelf="flex-end">
                  INACTIVE
                </Badge>
              ) : null /* Do not show any badge for dev-new */
            }
            {/* Show Remaining time and Progress bar only if timer display is enabled */}
            {shouldDisplayTimer && (
              <VStack align="end" spacing={1} w="100%">
                <Text fontSize="sm" color="gray.700">
                  Remaining: {remainingTimeStr}
                </Text>
                {/* --- ADD PROGRESS BAR START --- */}
                <Progress
                  value={progressPercent}
                  size="xs"
                  colorScheme={colorScheme} // Match the button color
                  w="100%" // Take full width of the VStack
                  borderRadius="sm"
                  hasStripe
                  isAnimated={progressPercent < 100} // Animate only while active
                  aria-label={`Timer progress for ${env}`}
                />
                {/* --- ADD PROGRESS BAR END --- */}
              </VStack>
            )}
            {/* --- MODIFY BADGE DISPLAY FOR DEV-NEW END --- */}
            <Button
              colorScheme={colorScheme}
              onClick={() => handleCommandClick(env)}
              isLoading={commandLoading}
              isDisabled={kaftStatusData.loading} // Disable if global status is loading
              size="sm"
              variant="outline"
            >
              Run `kaft env {env}`
            </Button>
          </VStack>
        </HStack>
      </Box>
    );
  };

  // --- ADD DEFAULTS AND DYNAMIC RENDER START ---
  const defaultEnvs = ["localdev", "master", "dev-new"];
  const envColors = {
    localdev: "teal",
    master: "purple",
    "dev-new": "blue",
  };

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.100" py={5}>
        <VStack
          spacing={4}
          maxW="container.md"
          mx="auto"
          p={4}
          bg="white"
          borderRadius="lg"
          boxShadow="md"
        >
          <HStack w="100%" justify="space-between" mb={2}>
            <Text fontSize="xl" fontWeight="bold">
              Auto Kaft
            </Text>
            <Tooltip label="Refresh Status" aria-label="Refresh Status Button">
              <IconButton
                icon={<RepeatIcon />}
                aria-label="Refresh Status"
                onClick={fetchAndUpdateKaftStatus}
                isLoading={kaftStatusData.loading}
                size="sm"
                variant="ghost"
              />
            </Tooltip>
          </HStack>

          {defaultEnvs.map((envKey) =>
            renderEnvironmentControl(envKey, envColors[envKey] || "gray")
          )}

          {/* --- ADD DEBUG OUTPUT START --- */}
          {(rawStatusOutput !== null || parsedStatusMap !== null) && (
            <Box
              w="100%"
              mt={6}
              p={4}
              bg="gray.50"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
            >
              <Text fontWeight="bold" mb={2}>
                Debug Info:
              </Text>
              {rawStatusOutput !== null && (
                <Box mb={3}>
                  <Text fontSize="sm" fontWeight="semibold" mb={1}>
                    Raw 'kaft status' Output:
                  </Text>
                  <Box
                    as="pre"
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                    p={2}
                    bg="gray.100"
                    borderRadius="sm"
                    fontSize="xs"
                    maxHeight="200px"
                    overflowY="auto"
                  >
                    {rawStatusOutput}
                  </Box>
                </Box>
              )}
              {parsedStatusMap !== null && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={1}>
                    Parsed Status Map:
                  </Text>
                  <Box
                    as="pre"
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                    p={2}
                    bg="gray.100"
                    borderRadius="sm"
                    fontSize="xs"
                    maxHeight="200px"
                    overflowY="auto"
                  >
                    {JSON.stringify(parsedStatusMap, null, 2)}
                  </Box>
                </Box>
              )}
            </Box>
          )}
          {/* --- ADD DEBUG OUTPUT END --- */}
        </VStack>
      </Box>
    </ChakraProvider>
  );
  // --- ADD DEFAULTS AND DYNAMIC RENDER END ---
}

export default App;
