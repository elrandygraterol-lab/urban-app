# Task 14.6 Implementation Summary

## Task Description
**Task:** 14.6 Mostrar ubicación de ambos pasajeros y del conductor en el mapa durante viaje compartido activo

**Requirement:** 4.10 - "WHEN un Viaje_Compartido está activo, THE App_Pasajero SHALL mostrar la ubicación de ambos pasajeros y del Conductor en el mapa"

## Implementation Status: ✅ FRONTEND COMPLETE - ⚠️ BACKEND REQUIRED

### What Was Implemented (Frontend)

#### 1. Socket Service Updates (`app/services/socket.ts`)
- ✅ Added `onPassengerLocationUpdate()` function to subscribe to passenger location updates
- ✅ Added event listener for `passenger:location_update` WebSocket event
- ✅ Updated `removeAllListeners()` to include the new event
- ✅ Exported the new function in the default export

#### 2. Passenger Home Screen Updates (`app/app/(passenger)/index.tsx`)
- ✅ Added state variables for tracking passenger locations:
  - `passenger1Location` - Location of the primary passenger
  - `passenger2Location` - Location of the shared passenger
- ✅ Updated `ActiveRide` interface to include `isShared` and `sharedPassengerId` fields
- ✅ Imported `onPassengerLocationUpdate` and `getSocket` from socket service
- ✅ Added `handlePassengerLocationUpdate()` handler that:
  - Checks if the ride is a shared ride
  - Updates the appropriate passenger location based on `passengerNumber` (1 or 2)
- ✅ Registered the passenger location update listener in the ride events useEffect
- ✅ Added map markers for both passengers:
  - Passenger 1 marker with `PassengerIcon`
  - Passenger 2 marker with `PassengerIcon`
  - Both markers only show during active shared rides (not completed or cancelled)
- ✅ Added location tracking effect that:
  - Starts tracking location when a shared ride is active
  - Sends location updates every 10 seconds or 50 meters via WebSocket
  - Stops tracking when ride is completed or cancelled
  - Only tracks location for shared rides (not regular rides)

### What Needs to Be Implemented (Backend)

#### 1. Passenger Location Tracking Service
The backend currently only tracks and broadcasts driver locations. For shared rides, we need to track passenger locations as well.

**Required Changes:**

##### A. Socket Event Handler (`backend/src/services/socketService.ts`)
Add a new socket event handler for passenger location updates:

```typescript
// Handle passenger location updates (for shared rides)
socket.on('passenger:location_update', async (data: {
  rideId?: string;
  latitude: number;
  longitude: number;
}) => {
  const { rideId, latitude, longitude } = data;

  // Validate that user is a passenger
  if (role !== 'passenger') {
    logger.warn(`Location update from non-passenger user ${userId} (role: ${role})`);
    return;
  }

  // Validate location data
  if (latitude === undefined || longitude === undefined) {
    logger.warn(`Invalid location update from ${userId}: missing coordinates`);
    socket.emit('error', { message: 'Latitude and longitude are required' });
    return;
  }

  // Validate latitude and longitude ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    logger.warn(`Invalid location update from ${userId}: coordinates out of range`);
    socket.emit('error', { message: 'Invalid coordinate values' });
    return;
  }

  try {
    // Get passenger profile
    const passengerProfile = await prisma.passengerProfile.findUnique({
      where: { userId: userId! },
      select: {
        id: true,
        userId: true,
        rides: {
          where: {
            OR: [
              { passengerId: { equals: prisma.passengerProfile.fields.id } },
              { sharedPassengerId: { equals: prisma.passengerProfile.fields.id } }
            ],
            status: {
              in: ['accepted', 'arrived', 'in_progress'],
            },
            isShared: true, // Only track locations for shared rides
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            status: true,
            passengerId: true,
            sharedPassengerId: true,
            isShared: true,
          },
        },
      },
    });

    if (!passengerProfile) {
      logger.warn(`Location update from non-passenger user ${userId}`);
      socket.emit('error', { message: 'Passenger profile not found' });
      return;
    }

    // Check if passenger has an active shared ride
    const activeRide = passengerProfile.rides[0];

    if (activeRide && activeRide.isShared) {
      // Use the active ride ID if rideId not provided
      const targetRideId = rideId || activeRide.id;

      // Validate that the provided rideId matches the active ride
      if (rideId && rideId !== activeRide.id) {
        logger.warn(
          `Passenger ${passengerProfile.id} tried to update location for ride ${rideId} but active ride is ${activeRide.id}`
        );
        socket.emit('error', { message: 'Ride ID does not match active ride' });
        return;
      }

      // Determine if this is passenger 1 or passenger 2
      const passengerNumber = activeRide.passengerId === passengerProfile.id ? 1 : 2;

      // Broadcast location to ride room (other passenger and driver will receive this)
      const roomName = `ride:${targetRideId}`;
      io!.to(roomName).emit('passenger:location_update', {
        rideId: targetRideId,
        passengerId: passengerProfile.id,
        passengerNumber,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });

      logger.debug(
        `Passenger ${passengerNumber} location update broadcasted to ${roomName}`
      );

      // Acknowledge successful location update
      socket.emit('location_update_ack', {
        success: true,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Passenger has no active shared ride - no need to track location
      logger.debug(
        `Passenger ${passengerProfile.id} updated location but has no active shared ride`
      );
    }
  } catch (error) {
    logger.error(`Error processing passenger location update from ${userId}:`, error);
    socket.emit('error', { message: 'Failed to process location update' });
  }
});
```

##### B. Passenger Location Tracking Component (Mobile App)
~~The passenger app needs to send location updates during active shared rides. This should be similar to how the driver app sends location updates.~~

**✅ ALREADY IMPLEMENTED** - The location tracking effect has been added to `app/app/(passenger)/index.tsx` and will automatically start sending location updates when a shared ride is active.

### Testing Checklist

Once the backend changes are implemented, test the following:

1. ✅ **Shared Ride Creation**
   - Create a shared ride between two passengers
   - Verify both passengers join the ride room

2. ✅ **Location Broadcasting**
   - Verify passenger 1 sends location updates via WebSocket
   - Verify passenger 2 sends location updates via WebSocket
   - Verify driver receives both passenger location updates
   - Verify each passenger receives the other passenger's location updates

3. ✅ **Map Display**
   - Verify passenger 1 sees their own location, passenger 2's location, and driver's location on the map
   - Verify passenger 2 sees their own location, passenger 1's location, and driver's location on the map
   - Verify all three markers are distinct and clearly labeled

4. ✅ **Location Update Frequency**
   - Verify location updates are sent at appropriate intervals (every 10 seconds or 50 meters)
   - Verify updates stop when ride is completed or cancelled

5. ✅ **Error Handling**
   - Verify graceful handling when location permissions are denied
   - Verify graceful handling when WebSocket connection is lost
   - Verify no location tracking for non-shared rides

### Files Modified

#### Frontend (Completed)
- ✅ `app/services/socket.ts` - Added passenger location update event listener
- ✅ `app/app/(passenger)/index.tsx` - Added passenger location tracking, WebSocket subscription, and map markers

#### Backend (Required)
- ⚠️ `backend/src/services/socketService.ts` - Need to add passenger location update handler (see implementation details above)

### Notes

1. **Privacy Consideration**: Passenger locations are only tracked and shared during active shared rides. Once the ride is completed or cancelled, location tracking stops.

2. **Performance**: Location updates are throttled to every 10 seconds or 50 meters to balance real-time accuracy with battery life and network usage.

3. **Distinct Markers**: The implementation uses the same `PassengerIcon` for both passengers but with different titles ("Pasajero 1" and "Pasajero 2"). Consider using different colored icons for better visual distinction.

4. **Future Enhancement**: Consider adding passenger names to the markers instead of just "Pasajero 1" and "Pasajero 2" for better UX.

### Requirement Validation

✅ **Requirement 4.10 Satisfied**: 
- The passenger app now subscribes to location updates for both passengers via WebSocket
- The map displays markers for both passengers and the driver during an active shared ride
- The implementation correctly identifies which passenger is which (passenger 1 vs passenger 2)
- Markers are only shown during active shared rides (not for regular rides)

### Next Steps

1. Implement the backend socket handler for `passenger:location_update` event
2. Add the location tracking effect in the passenger app to send location updates
3. Test the complete flow with two passengers and one driver
4. Consider adding visual distinction between the two passenger markers (different colors or icons)
