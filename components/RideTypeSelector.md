# RideTypeSelector Component

## Overview

The `RideTypeSelector` component is a modal that allows passengers to choose the type of ride they want to request. It serves as the entry point for the ride request flow, presenting three distinct ride options.

## Features

- **Three Ride Type Options:**
  1. **Viaje Individual** - Standard ride for a single passenger with 1 pickup and 1 destination
  2. **Viaje Compartido** - Shared ride with another registered passenger (opens SharedRideModal)
  3. **Pedir Viaje Para Otro** - Delegated ride for a non-registered beneficiary (opens DelegatedRideModal)

- **Visual Distinction:** Each option has a unique icon, color scheme, and descriptive text
- **Accessibility:** Full accessibility support with proper labels and hints
- **Responsive Design:** Adapts to different screen sizes with safe area insets

## Requirements Validated

- **Requirement 4.1:** Shows "Viaje Compartido" option that opens SharedRideModal
- **Requirement 9.1:** Shows "Pedir Viaje Para Otro" option that opens DelegatedRideModal

## Props

```typescript
interface RideTypeSelectorProps {
  /** Whether the modal is visible */
  visible: boolean;
  
  /** Called when user selects "Viaje Individual" */
  onSelectIndividual: () => void;
  
  /** Called when user selects "Viaje Compartido" */
  onSelectShared: () => void;
  
  /** Called when user selects "Pedir Viaje Para Otro" */
  onSelectDelegated: () => void;
  
  /** Called when the user dismisses the modal */
  onClose: () => void;
}
```

## Usage Example

```typescript
import RideTypeSelector from '@/components/RideTypeSelector';

function PassengerHomeScreen() {
  const [showRideTypeSelector, setShowRideTypeSelector] = useState(false);
  const [showSharedRideModal, setShowSharedRideModal] = useState(false);
  const [showDelegatedRideModal, setShowDelegatedRideModal] = useState(false);

  const handleSelectIndividual = () => {
    setShowRideTypeSelector(false);
    // Show standard ride request screen with 1 pickup and 1 destination
  };

  const handleSelectShared = () => {
    setShowRideTypeSelector(false);
    setShowSharedRideModal(true);
  };

  const handleSelectDelegated = () => {
    setShowRideTypeSelector(false);
    setShowDelegatedRideModal(true);
  };

  return (
    <>
      <TouchableOpacity onPress={() => setShowRideTypeSelector(true)}>
        <Text>Solicitar Viaje</Text>
      </TouchableOpacity>

      <RideTypeSelector
        visible={showRideTypeSelector}
        onSelectIndividual={handleSelectIndividual}
        onSelectShared={handleSelectShared}
        onSelectDelegated={handleSelectDelegated}
        onClose={() => setShowRideTypeSelector(false)}
      />

      {/* Other modals */}
    </>
  );
}
```

## Design Decisions

### Visual Hierarchy

Each ride type option is presented as a card with:
- **Icon Container:** Circular white background with colored icon
- **Title:** Bold, prominent text
- **Description:** Smaller, gray text explaining the option
- **Chevron:** Right-pointing arrow indicating the option is selectable

### Color Scheme

- **Viaje Individual:** Green theme (primary color) - standard, most common option
- **Viaje Compartido:** Blue theme - collaborative, sharing concept
- **Pedir Viaje Para Otro:** Purple theme - special, gift-like feature

### Accessibility

- All touchable elements have `accessibilityRole="button"`
- Each option has `accessibilityLabel` and `accessibilityHint`
- Close button has clear "Cerrar" label

## Integration Points

### SharedRideModal

When "Viaje Compartido" is selected, the parent component should:
1. Close the RideTypeSelector
2. Open the SharedRideModal
3. Pass pickup points, destination points, and estimated fare

### DelegatedRideModal (Future)

When "Pedir Viaje Para Otro" is selected, the parent component should:
1. Close the RideTypeSelector
2. Open the DelegatedRideModal (to be implemented in task 14.5.1)
3. Allow entry of beneficiary data and ride details

### Standard Ride Flow

When "Viaje Individual" is selected, the parent component should:
1. Close the RideTypeSelector
2. Show the standard ride request screen
3. Limit to 1 pickup point and 1 destination point

## Testing

The component includes unit tests that verify:
- Component exports correctly
- Accepts all required props without errors
- Has correct display name

## Future Enhancements

- Add animation when options are selected
- Add tooltips or help icons for each option
- Track analytics for which ride type is most popular
- Add "Recently Used" indicator for frequently selected options

## Related Components

- `SharedRideModal` - Opened when "Viaje Compartido" is selected
- `DelegatedRideModal` - Opened when "Pedir Viaje Para Otro" is selected (to be implemented)
- `PassengerHomeScreen` - Parent component that manages the ride request flow
