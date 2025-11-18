// /metro-ar-app/src/ARNavigation.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert, Linking } from 'react-native';
// Assuming lucide-react-native is installed for non-AR UI
import { MapPin, ArrowRight } from 'lucide-react-native'; 

// --- VIRO REACT IMPORTS ---
import { 
    ViroARSceneNavigator, 
    ViroText,
    ViroConstants,
    ViroBox, // Simple 3D primitive for an arrow/marker
    Viro3DObject,
    ViroTrackingStateConstants,
    ViroARScene,
    ViroMaterials,
} from '@viro-community/react-viro';
// --------------------------


const DESTINATION_WAYPOINT_ID = "PLATFORM_B_NORTH";
// TODO: Replace with your actual Viro API key after registering!
const VIRO_API_KEY = "YOUR_VIRO_API_KEY_HERE"; 


// --- 1. The Core AR Scene (Replaces ARScene) ---
// This is the actual 3D world where you render the path.
const ARNavigationScene = ({ arSceneNavigator }) => {
    
    // Props passed down from the navigator's initialProperties
    const { 
        pathInstructions, 
        currentStepIndex, 
        onStepCompleted 
    } = arSceneNavigator.viroSceneProperties.pathData;

    // --- SLAM Tracking State ---
    const [trackingState, setTrackingState] = useState(ViroConstants.ViroTrackingState.NOT_INITIALIZED);
    
    // Function that runs every frame to check tracking status
    function onTrackingUpdated(state) {
        if (state === ViroConstants.ViroTrackingState.TRACKING_NORMAL) {
            setTrackingState(ViroTrackingStateConstants.TRACKING_NORMAL);
        } else {
            setTrackingState(state);
        }
    }
    
    // Logic to render the next arrow
    const renderNextArrow = () => {
        if (currentStepIndex >= pathInstructions.length) {
            return (
                <ViroText
                    text="Destination Reached!"
                    position={[0, 0.5, -2]}
                    style={{ fontSize: 30, color: '#00FF00' }}
                    height={3}
                    width={3}
                    // Anchored to the real world
                    transformBehaviors={['billboard']} 
                />
            );
        }
        
        // --- SIMULATION of 3D Path Anchoring ---
        // In a completed app, you would translate your waypoint coordinates (lat/lng) 
        // into Viro's 3D coordinate system (x, y, z) here. 
        const simulatedArrowPosition = [0, 0, -2]; 
        const currentInstruction = pathInstructions[currentStepIndex];

        return (
            <>
                {/* 3D Arrow / Box Placeholder */}
                <ViroBox
                    position={simulatedArrowPosition}
                    scale={[0.2, 0.2, 0.2]}
                    materials={["arrowMaterial"]}
                />
                
                {/* Instruction Text */}
                <ViroText
                    text={currentInstruction}
                    position={[0, 0.5, -2]}
                    style={{ fontSize: 20, color: '#FFFFFF' }}
                    height={3}
                    width={3}
                    transformBehaviors={['billboard']}
                />
                
                {/* SIMULATION for Step Completion */}
                <ViroText
                    text="Tap to complete step"
                    position={[0, 0, -3]}
                    onClick={onStepCompleted} // Function passed from the main component
                    style={{ fontSize: 15, color: '#FFFF00' }}
                    height={1}
                    width={1}
                    transformBehaviors={['billboard']}
                />
            </>
        );
    };

    return (
        <ViroARScene onTrackingUpdated={onTrackingUpdated}>
            {trackingState === ViroTrackingStateConstants.TRACKING_NORMAL ? (
                renderNextArrow()
            ) : (
                <ViroText 
                    text="Move phone to initialize SLAM..." 
                    position={[0, 0, -5]} 
                    style={{ fontSize: 25, color: '#FF0000' }}
                />
            )}
        </ViroARScene>
    );
};

// Define a simple material for the arrow
ViroMaterials.createMaterials({
    arrowMaterial: {
        diffuseColor: "#007BFF" // Blue for navigation
    },
});


// --- 2. The Main Container (Replaces ARNavigation.tsx) ---
const ARNavigation = () => {
    const [pathInstructions, setPathInstructions] = useState<string[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // --- Core Logic: Fetch Path from A* Backend ---
    const fetchPath = async (fromId: string) => {
        setIsScanning(false);
        try {
            const response = await fetch(
                `http://localhost:3001/api/ar-route?from=${fromId}&to=${DESTINATION_WAYPOINT_ID}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                Alert.alert("Route Error", errorData.error);
                setPathInstructions([]);
                return;
            }

            const instructions: string[] = await response.json();
            setPathInstructions(instructions);
            setCurrentStepIndex(0);
        } catch (error) {
            Alert.alert("Network Error", "Could not connect to the backend server.");
        }
    };

    // --- Simulating QR Code Scan ---
    const handleInitialScan = () => {
        setIsScanning(true);
        
        // Simulating QR code scan success and fetching path
        setTimeout(() => {
            const scannedId = "TICKET_OFFICE_ENT"; 
            Alert.alert("Scan Success", `Waypoint: ${scannedId}. Fetching route...`);
            fetchPath(scannedId);
        }, 3000);
    };

    // --- Handler for when the user completes a step ---
    const handleStepCompleted = () => {
        setCurrentStepIndex(prev => {
            if (prev < pathInstructions.length) {
                Alert.alert("Step Complete", `Moving to next instruction: ${pathInstructions[prev + 1] || "Destination"}`);
            }
            return prev + 1;
        });
    };

    // --- Properties passed to the AR Scene ---
    const arSceneProps = {
        pathData: {
            pathInstructions,
            currentStepIndex,
            onStepCompleted: handleStepCompleted,
        }
    };

    if (pathInstructions.length === 0 && !isScanning) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Welcome to Metro Mitra AR</Text>
                <Text style={styles.subtitle}>Scan a QR Code to begin indoor navigation.</Text>
                <Button title="Start AR Scan" onPress={handleInitialScan} />
                <ActivityIndicator animating={isScanning} size="large" />
            </View>
        );
    }
    
    return (
        <View style={styles.container}>
            {/* ViroARSceneNavigator replaces the conceptual ARView. 
                The 'initialScene' points to the scene component we defined.
                'viroAppProps' is how we pass path data down to the 3D scene.
            */}
            <ViroARSceneNavigator
                initialScene={{ scene: ARNavigationScene }}
                viroAppProps={arSceneProps}
               // apiKey={VIRO_API_KEY}
                // Optional: Enable debug features if needed
                // debug={true}
            />

            {/* Simple Overlay UI for context */}
            <View style={styles.overlay}>
                <Text style={styles.headerText}>
                    {currentStepIndex < pathInstructions.length 
                        ? `Step ${currentStepIndex + 1}/${pathInstructions.length}` 
                        : "Arrived!"}
                </Text>
            </View>

            {/* Restart Button */}
            <View style={styles.buttonContainer}>
                <Button 
                    title="Stop & Restart" 
                    onPress={() => setPathInstructions([])} 
                    color="red"
                />
            </View>
        </View>
    );
};

// --- Styles (React Native StyleSheet) ---

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    subtitle: { fontSize: 16, color: '#ccc', marginBottom: 20 },
    overlay: { 
        position: 'absolute', 
        top: 40, 
        left: 20, 
        padding: 10, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        borderRadius: 5, 
        zIndex: 10 
    },
    headerText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    buttonContainer: {
        position: 'absolute',
        bottom: 50,
        width: '80%',
        alignSelf: 'center',
        zIndex: 10,
    }
});

export default ARNavigation;