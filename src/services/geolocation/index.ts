export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function watchDriverLocation(
  onUpdate: (coordinates: Coordinates) => void,
  onError: (error: GeolocationPositionError | Error) => void,
): () => void {
  if (!navigator.geolocation) {
    const error = new Error('La géolocalisation n’est pas disponible sur cet appareil.');
    onError(error);
    return () => undefined;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    onError,
    {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 10_000,
    },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
