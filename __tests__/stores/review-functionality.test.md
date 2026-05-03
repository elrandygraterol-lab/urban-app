# Review Functionality Test Plan

## Test Suite: Rating and Review Functionality (Task 17)

### Test Environment Setup
- Mobile app running on iOS/Android simulator
- Backend API running and accessible
- Test user authenticated with valid token
- Test store available with ID

---

## Test Case 17.1.1: Create Review with Rating and Comment

**Objective:** Verify user can create a new review with rating and comment

**Prerequisites:**
- User is authenticated
- User has NOT reviewed the store before
- Store details screen is open

**Steps:**
1. Navigate to store details screen
2. Tap "Calificar" button in action buttons section
3. Verify RatingDialog opens with title "Calificar Tienda"
4. Select 4 stars
5. Enter comment: "Excelente servicio y productos de calidad"
6. Verify character counter shows remaining characters
7. Tap "Enviar" button
8. Wait for API response

**Expected Results:**
- ✅ Dialog opens successfully
- ✅ Rating stars are interactive
- ✅ Comment field accepts text input
- ✅ Character counter updates in real-time
- ✅ "Enviar" button is enabled when rating is selected
- ✅ Success alert shows: "Tu calificación ha sido enviada"
- ✅ Dialog closes automatically
- ✅ Store rating updates in header
- ✅ Review count increments by 1
- ✅ New review appears at top of reviews list
- ✅ Review shows correct rating, comment, and user name

---

## Test Case 17.1.2: Create Review with Rating Only (No Comment)

**Objective:** Verify user can create a review with only a rating

**Prerequisites:**
- User is authenticated
- User has NOT reviewed the store before

**Steps:**
1. Open store details screen
2. Tap "Calificar" button
3. Select 5 stars
4. Leave comment field empty
5. Tap "Enviar" button

**Expected Results:**
- ✅ Review is created successfully
- ✅ Success alert appears
- ✅ Review appears in list with rating but no comment text

---

## Test Case 17.1.3: Validation - Submit Without Rating

**Objective:** Verify validation prevents submission without rating

**Prerequisites:**
- User is authenticated
- RatingDialog is open

**Steps:**
1. Open RatingDialog
2. Leave rating at 0 stars (don't select any)
3. Enter comment: "Test comment"
4. Tap "Enviar" button

**Expected Results:**
- ✅ Error alert shows: "Por favor selecciona una calificación"
- ✅ Dialog remains open
- ✅ Review is NOT created

---

## Test Case 17.1.4: Validation - Comment Length Limit

**Objective:** Verify comment length validation (max 500 chars)

**Prerequisites:**
- User is authenticated
- RatingDialog is open

**Steps:**
1. Open RatingDialog
2. Select 3 stars
3. Enter comment with 501 characters
4. Observe character counter
5. Try to tap "Enviar" button

**Expected Results:**
- ✅ Character counter shows negative number (e.g., "-1 caracteres restantes")
- ✅ Character counter text turns red
- ✅ Comment field border turns red
- ✅ "Enviar" button is disabled (grayed out)
- ✅ Cannot submit review

---

## Test Case 17.2.1: Edit Existing Review

**Objective:** Verify user can edit their own review

**Prerequisites:**
- User is authenticated
- User has already reviewed the store
- Store details screen shows user's review

**Steps:**
1. Scroll to reviews section
2. Locate user's own review (should have edit/delete buttons)
3. Tap edit button (pencil icon)
4. Verify RatingDialog opens with title "Editar Calificación"
5. Verify rating is pre-filled with existing rating
6. Verify comment is pre-filled with existing comment
7. Change rating from 4 to 5 stars
8. Modify comment: "Actualizado: Servicio mejorado"
9. Tap "Actualizar" button

**Expected Results:**
- ✅ Dialog opens with existing data pre-filled
- ✅ Can modify rating and comment
- ✅ Success alert shows: "Tu calificación ha sido actualizada"
- ✅ Dialog closes
- ✅ Review in list updates with new rating and comment
- ✅ Store average rating updates if changed
- ✅ Review timestamp shows "updated_at" date

---

## Test Case 17.2.2: Edit Button Only Shows for Own Review

**Objective:** Verify edit button only appears on user's own review

**Prerequisites:**
- User is authenticated
- Store has multiple reviews from different users

**Steps:**
1. Open store details screen
2. Scroll to reviews section
3. Examine each review item

**Expected Results:**
- ✅ User's own review shows edit and delete buttons
- ✅ Other users' reviews do NOT show edit/delete buttons
- ✅ Only user avatar, name, rating, comment, and date are shown for others

---

## Test Case 17.3.1: Delete Review with Confirmation

**Objective:** Verify user can delete their review with confirmation

**Prerequisites:**
- User is authenticated
- User has reviewed the store

**Steps:**
1. Open store details screen
2. Locate user's review in reviews section
3. Tap delete button (trash icon)
4. Verify confirmation dialog appears
5. Read confirmation message
6. Tap "Eliminar" button

**Expected Results:**
- ✅ Confirmation dialog shows with title "Eliminar Calificación"
- ✅ Message asks: "¿Estás seguro de que deseas eliminar tu calificación?"
- ✅ Two buttons: "Cancelar" and "Eliminar"
- ✅ After confirming, success alert shows: "Tu calificación ha sido eliminada"
- ✅ Review is removed from list
- ✅ Store average rating updates
- ✅ Review count decrements by 1
- ✅ If it was the only review, "No hay reseñas aún" message appears

---

## Test Case 17.3.2: Cancel Delete Operation

**Objective:** Verify user can cancel delete operation

**Prerequisites:**
- User is authenticated
- User has reviewed the store

**Steps:**
1. Open store details screen
2. Tap delete button on user's review
3. Confirmation dialog appears
4. Tap "Cancelar" button

**Expected Results:**
- ✅ Dialog closes
- ✅ Review is NOT deleted
- ✅ Review remains in list
- ✅ No changes to store rating or review count

---

## Test Case 17.3.3: Delete Button Only Shows for Own Review

**Objective:** Verify delete button only appears on user's own review

**Prerequisites:**
- User is authenticated
- Store has multiple reviews

**Steps:**
1. Open store details screen
2. Examine reviews section

**Expected Results:**
- ✅ User's own review shows delete button
- ✅ Other users' reviews do NOT show delete button

---

## Test Case 17.4: Store Rating Updates After Operations

**Objective:** Verify store rating and count update correctly after review operations

**Prerequisites:**
- User is authenticated
- Store has existing reviews

**Test Scenario A - Create Review:**
1. Note current average rating and review count
2. Create new review with 5 stars
3. Verify rating increases and count increments

**Test Scenario B - Edit Review:**
1. Note current average rating
2. Edit review from 3 stars to 5 stars
3. Verify rating increases

**Test Scenario C - Delete Review:**
1. Note current average rating and review count
2. Delete review
3. Verify rating recalculates and count decrements

**Expected Results:**
- ✅ Average rating updates correctly after each operation
- ✅ Review count updates correctly
- ✅ Changes are visible immediately in store header
- ✅ Star display updates to reflect new rating

---

## Test Case 17.5: Error Handling

**Objective:** Verify proper error handling for network failures

**Test Scenario A - Network Error During Create:**
1. Disable network connection
2. Try to create review
3. Observe error handling

**Test Scenario B - Network Error During Update:**
1. Disable network connection
2. Try to update review
3. Observe error handling

**Test Scenario C - Network Error During Delete:**
1. Disable network connection
2. Try to delete review
3. Observe error handling

**Expected Results:**
- ✅ Error alert shows user-friendly message
- ✅ Dialog remains open (for create/edit)
- ✅ Review is not removed from list (for delete)
- ✅ User can retry operation
- ✅ No app crash or freeze

---

## Test Case 17.6: Loading States

**Objective:** Verify loading states during API operations

**Steps:**
1. Open RatingDialog
2. Select rating and enter comment
3. Tap "Enviar" button
4. Observe button state during API call

**Expected Results:**
- ✅ Button text changes to "Enviando..."
- ✅ Button is disabled during submission
- ✅ User cannot tap button multiple times
- ✅ Rating stars are disabled during submission
- ✅ Comment field is disabled during submission

---

## Test Case 17.7: Integration with Store Details

**Objective:** Verify review functionality integrates properly with store details

**Steps:**
1. Open store details screen
2. Verify "Calificar" button is visible in action buttons
3. Verify reviews section shows at bottom
4. Verify "Escribir reseña" button shows if user hasn't reviewed
5. Create a review
6. Verify "Escribir reseña" button disappears
7. Verify edit/delete buttons appear on user's review

**Expected Results:**
- ✅ All UI elements are properly positioned
- ✅ Reviews section is scrollable
- ✅ Store rating in header matches reviews
- ✅ Review count matches number of reviews shown
- ✅ UI updates dynamically based on user's review status

---

## Performance Tests

### Test Case 17.8: Large Number of Reviews

**Objective:** Verify performance with many reviews

**Prerequisites:**
- Store has 50+ reviews

**Steps:**
1. Open store details screen
2. Scroll to reviews section
3. Observe rendering performance

**Expected Results:**
- ✅ Reviews render smoothly
- ✅ No lag or stuttering
- ✅ FlatList virtualization works correctly
- ✅ Pagination loads more reviews as needed

---

## Accessibility Tests

### Test Case 17.9: Screen Reader Support

**Objective:** Verify accessibility for visually impaired users

**Steps:**
1. Enable screen reader (VoiceOver/TalkBack)
2. Navigate to store details
3. Navigate to reviews section
4. Try to create a review

**Expected Results:**
- ✅ All buttons have proper labels
- ✅ Rating stars are accessible
- ✅ Form fields have proper labels
- ✅ Success/error messages are announced

---

## Summary

**Total Test Cases:** 17
**Critical Test Cases:** 10 (17.1.1, 17.1.3, 17.1.4, 17.2.1, 17.3.1, 17.4, 17.5)
**Nice-to-Have Test Cases:** 7

**Estimated Testing Time:** 2-3 hours for complete manual testing

**Automation Recommendations:**
- Automate validation tests (17.1.3, 17.1.4)
- Automate CRUD operations (17.1.1, 17.2.1, 17.3.1)
- Automate error handling (17.5)
- Manual testing for UI/UX aspects (17.7, 17.9)
