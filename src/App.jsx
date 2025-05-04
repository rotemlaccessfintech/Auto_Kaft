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

  // Updated handleCommandClick
  const handleCommandClick = async (env) => {
    console.log(`[App HandleClick] Clicked ${env}.`);
    setActiveTimers((prev) => ({ ...prev, [env]: Date.now() }));
    setKaftStatusData((prev) => ({ ...prev, loading: true, error: null })); // Show loading

    try {
      console.log(
        `[App HandleClick] Calling electronAPI.executeCommand for ${env}`
      );
      const data = await window.electronAPI.executeCommand(env);
      console.log(`[App HandleClick] executeCommand result for ${env}:`, data);

      if (!data || !data.success) {
        throw new Error(
          data?.error || data?.stderr || "Failed to execute command"
        );
      }

      let updatedAppsMap = {};

      // Parse the output from the successful command to find the friendly name AND the new status
      if (data.output) {
        const { appsList, appsMap } = parseKaftStatus(data.output);
        updatedAppsMap = appsMap; // Get the status directly from this command's output

        if (appsList.length > 0) {
          const lastApp = appsList[appsList.length - 1];
          const friendlyName = lastApp.name;
          console.log(
            `[App HandleClick] Identified friendly name for ${env} as ${friendlyName} (last entry).`
          );
          setEnvNameMapping((prev) => ({ ...prev, [env]: friendlyName }));
        } else {
          console.warn(
            `[App HandleClick] No apps found in kaft env ${env} output to determine friendly name.`
          );
        }
      } else {
        console.warn(
          `[App HandleClick] No output received from kaft env ${env} command.`
        );
        // If no output, we might need to fetch status separately as a fallback?
        // For now, we'll just show potentially stale data.
      }

      // Directly update the status data with the parsed map from the command output
      console.log(
        "[App HandleClick] Updating kaftStatusData directly with parsed output:",
        updatedAppsMap
      );
      setKaftStatusData({ loading: false, apps: updatedAppsMap, error: null });

      toast({
        title: "Command Executed",
        description: `"kaft env ${env}" finished. Status updated.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // REMOVED: await fetchAndUpdateKaftStatus(); // Don't fetch separately
    } catch (error) {
      console.error(
        `[App HandleClick] Error executing command for ${env}:`,
        error
      );
      setActiveTimers((prev) => {
        const newTimers = { ...prev };
        delete newTimers[env];
        return newTimers;
      });
      // Keep previous app data but set loading false and show error
      setKaftStatusData((prev) => ({
        ...prev,
        loading: false,
        error: `Command failed: ${error.message}`,
      }));
      toast({
        title: "Command Failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Updated render control to use mapping and descriptions
  const renderEnvironmentControl = (env, colorScheme) => {
    const uiTimerStart = activeTimers[env];
    const isUiTimerRunning =
      !!uiTimerStart && Date.now() - uiTimerStart < FOUR_HOURS_MS;
    const uiElapsedTime = isUiTimerRunning ? Date.now() - uiTimerStart : 0;

    // Get display name using the forward mapping (populated on click)
    const displayName = envNameMapping[env] || env;

    // Look up status using the short name (env) directly
    const verifiedAppData = kaftStatusData.apps[env];
    const isVerifiedActive = !!verifiedAppData;

    let indicatorColor = "gray.400";
    let statusText = "Unknown";
    let detailText = "";
    const showSpinner = kaftStatusData.loading;

    // --- ADD DESCRIPTION TO TOOLTIP START ---
    const description = envDescriptions[env] || "No description available.";
    let statusTooltip = `Description: ${description}`;
    // --- ADD DESCRIPTION TO TOOLTIP END ---

    if (!kaftStatusData.loading && kaftStatusData.error) {
      indicatorColor = "orange.400";
      statusText = "Status Error";
      detailText = kaftStatusData.error.substring(0, 30);
      // Prepend error to tooltip
      statusTooltip = `Error: ${kaftStatusData.error}\n${statusTooltip}`;
    } else if (!kaftStatusData.loading) {
      if (isVerifiedActive) {
        indicatorColor = "green.500";
        statusText = "Active";
        detailText = `Remaining: ${verifiedAppData.remaining}`;
        // Prepend active status info to tooltip
        let activeStatusInfo = `Status for: ${verifiedAppData.name} (Active)`;
        if (verifiedAppData.expiresAt) {
          const expiryDate = new Date(
            parseInt(verifiedAppData.expiresAt) * 1000
          );
          activeStatusInfo += ` - Expires: ${expiryDate.toLocaleString()}`;
        }
        statusTooltip = `${activeStatusInfo}\n${statusTooltip}`;
      } else {
        indicatorColor = "red.500";
        statusText = "Inactive";
        detailText = "";
        // Prepend inactive status info to tooltip
        statusTooltip = `Status for: ${displayName} (Inactive)\n${statusTooltip}`;
      }
    }

    // Add UI timer display if relevant and no other detail text
    if (isUiTimerRunning && !detailText) {
      detailText = `UI Elapsed: ${formatElapsedTime(uiElapsedTime)}`;
    }

    return (
      <HStack
        key={env}
        w="100%"
        justify="space-between"
        p={3}
        bg={`${colorScheme}.100`}
        borderRadius="md"
        boxShadow="sm"
        alignItems="flex-start"
      >
        <HStack alignItems="flex-start">
          <Tooltip
            label={statusTooltip}
            aria-label="Status and description tooltip"
            whiteSpace="pre-line"
            placement="top-start"
          >
            <Box
              w="10px"
              h="10px"
              bg={indicatorColor}
              borderRadius="full"
              mt={2.5}
            />
          </Tooltip>
          <VStack align="flex-start" spacing={0}>
            <Button
              colorScheme={colorScheme}
              variant="ghost"
              onClick={() => handleCommandClick(env)}
              isLoading={showSpinner && !!activeTimers[env] && !verifiedAppData}
              isDisabled={showSpinner}
              size="md"
            >
              kaft env {displayName}
            </Button>
            <Text fontSize="xs" color="gray.600" pl={4}>
              {description}
            </Text>
          </VStack>
        </HStack>
        <VStack align="flex-end" spacing={0}>
          <Badge colorScheme={isVerifiedActive ? "green" : "red"}>
            {statusText}
          </Badge>
          <Text fontSize="xs" color="gray.600">
            {detailText}
          </Text>
        </VStack>
      </HStack>
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
              CLI Command Interface
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
            <Box w="100%" mt={6} p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
              <Text fontWeight="bold" mb={2}>Debug Info:</Text>
              {rawStatusOutput !== null && (
                <Box mb={3}>
                  <Text fontSize="sm" fontWeight="semibold" mb={1}>Raw 'kaft status' Output:</Text>
                  <Box as="pre" whiteSpace="pre-wrap" wordBreak="break-all" p={2} bg="gray.100" borderRadius="sm" fontSize="xs" maxHeight="200px" overflowY="auto">
                    {rawStatusOutput}
                  </Box>
                </Box>
              )}
              {parsedStatusMap !== null && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={1}>Parsed Status Map:</Text>
                  <Box as="pre" whiteSpace="pre-wrap" wordBreak="break-all" p={2} bg="gray.100" borderRadius="sm" fontSize="xs" maxHeight="200px" overflowY="auto">
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
