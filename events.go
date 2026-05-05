package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"campus-orbit/config"
	"campus-orbit/models"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type DecideReq struct {
	Status string `json:"status"`
	Remark string `json:"remark"`
}

// save uploaded pdf and return public URL
func savePDF(c *gin.Context, fieldName string) (string, error) {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return "", nil
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".pdf" {
		return "", gin.Error{Err: err, Type: gin.ErrorTypePublic}
	}

	fileName := time.Now().Format("20060102150405") + "_" + filepath.Base(file.Filename)
	savePath := filepath.Join("uploads", fileName)

	if err := c.SaveUploadedFile(file, savePath); err != nil {
		return "", err
	}

	return "/uploads/" + fileName, nil
}

// ✅ STAFF: Create event
func CreateEvent(c *gin.Context) {
	title := strings.TrimSpace(c.PostForm("title"))
	dept := strings.TrimSpace(c.PostForm("dept"))
	typeVal := strings.TrimSpace(c.PostForm("type"))
	date := strings.TrimSpace(c.PostForm("date"))
	desc := strings.TrimSpace(c.PostForm("desc"))
	location := strings.TrimSpace(c.PostForm("location"))
	startTime := strings.TrimSpace(c.PostForm("startTime"))
	endTime := strings.TrimSpace(c.PostForm("endTime"))
	durationText := strings.TrimSpace(c.PostForm("durationText"))
	link := strings.TrimSpace(c.PostForm("link"))
	createdBy := strings.TrimSpace(c.PostForm("createdBy"))
	approvalRoute := strings.TrimSpace(c.PostForm("approvalRoute"))
	if approvalRoute == "" {
		approvalRoute = "BOTH"
	}

	if title == "" || dept == "" || typeVal == "" || date == "" || desc == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "All required fields must be filled"})
		return
	}
	initialStatus := "HOD_PENDING"

	switch approvalRoute {
	case "HOD":
		initialStatus = "HOD_PENDING"
	case "PRINCIPAL":
		initialStatus = "PRINCIPAL_PENDING"
	case "BOTH":
		initialStatus = "HOD_PENDING"
	default:
		initialStatus = "HOD_PENDING"
		approvalRoute = "BOTH"
	}

	pdfURL, err := savePDF(c, "pdf")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only PDF file is allowed"})
		return
	}

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	count, _ := col.CountDocuments(ctx, bson.M{
		"title": title,
		"dept":  dept,
		"date":  date,
	})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Same event already exists"})
		return
	}

	ev := models.Event{
		Title:         title,
		Dept:          dept,
		Type:          typeVal,
		Date:          date,
		Desc:          desc,
		Location:      location,
		StartTime:     startTime,
		EndTime:       endTime,
		DurationText:  durationText,
		Link:          link,
		PDFURL:        pdfURL,
		Status:        initialStatus,
		ApprovalRoute: approvalRoute,
		CreatedAt:     time.Now(),
		CreatedBy:     createdBy,
	}

	if ev.CreatedBy == "" {
		ev.CreatedBy = "Staff"
	}

	_, err = col.InsertOne(ctx, ev)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB insert failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Event sent to HOD for approval",
		"status":  ev.Status,
	})
}

// ✅ STAFF: Update event (UPDATED FOR HOD FLOW)
func UpdateEvent(c *gin.Context) {
	id := c.Param("id")
	objID, _ := primitive.ObjectIDFromHex(id)

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing models.Event
	err := col.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
		return
	}

	// ✅ FIX: allow editing if HOD asked changes
	if existing.Status != "HOD_PENDING" && existing.Status != "HOD_CHANGES_REQUIRED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot edit this event"})
		return
	}

	title := strings.TrimSpace(c.PostForm("title"))
	dept := strings.TrimSpace(c.PostForm("dept"))
	typeVal := strings.TrimSpace(c.PostForm("type"))
	date := strings.TrimSpace(c.PostForm("date"))
	desc := strings.TrimSpace(c.PostForm("desc"))
	location := strings.TrimSpace(c.PostForm("location"))
	startTime := strings.TrimSpace(c.PostForm("startTime"))
	endTime := strings.TrimSpace(c.PostForm("endTime"))
	durationText := strings.TrimSpace(c.PostForm("durationText"))
	link := strings.TrimSpace(c.PostForm("link"))

	count, _ := col.CountDocuments(ctx, bson.M{
		"_id":   bson.M{"$ne": objID},
		"title": title,
		"dept":  dept,
		"date":  date,
	})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Same event already exists"})
		return
	}

	pdfURL := existing.PDFURL
	newPDFURL, err := savePDF(c, "pdf")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only PDF file is allowed"})
		return
	}
	if newPDFURL != "" {
		pdfURL = newPDFURL
	}

	approvalRoute := strings.TrimSpace(c.PostForm("approvalRoute"))
	if approvalRoute == "" {
		approvalRoute = existing.ApprovalRoute
	}

	updatedStatus := "HOD_PENDING"
	switch approvalRoute {
	case "HOD":
		updatedStatus = "HOD_PENDING"
	case "PRINCIPAL":
		updatedStatus = "PRINCIPAL_PENDING"
	case "BOTH":
		updatedStatus = "HOD_PENDING"
	}

	update := bson.M{
		"$set": bson.M{
			"title":        title,
			"dept":         dept,
			"type":         typeVal,
			"date":         date,
			"desc":         desc,
			"location":     location,
			"startTime":    startTime,
			"endTime":      endTime,
			"durationText": durationText,
			"link":         link,
			"pdfUrl":       pdfURL,

			// ✅ IMPORTANT FLOW FIX
			"status":        updatedStatus,
			"approvalRoute": approvalRoute,
			"hodRemark":     "", // clear old remark
			"reviewedBy":    "",
		},
	}

	col.UpdateByID(ctx, objID, update)

	c.JSON(http.StatusOK, gin.H{
		"message": "Event updated successfully",
		"status":  updatedStatus,
		"route":   approvalRoute,
	})
}

// ✅ HOD: List pending
func ListHODPendingEvents(c *gin.Context) {
	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, _ := col.Find(ctx, bson.M{"status": "HOD_PENDING"})
	defer cur.Close(ctx)

	var list []models.Event
	cur.All(ctx, &list)

	c.JSON(http.StatusOK, list)
}

// ✅ HOD: Approve / Reject / Send Back
func HODDecideEvent(c *gin.Context) {
	id := c.Param("id")
	objID, _ := primitive.ObjectIDFromHex(id)

	var req DecideReq
	c.BindJSON(&req)

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// first read existing event from DB
	var existing models.Event
	err := col.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
		return
	}

	// old data may not have approvalRoute, so keep BOTH as default
	route := existing.ApprovalRoute
	if route == "" {
		route = "BOTH"
	}

	var newStatus string

	switch req.Status {
	case "APPROVED":
		if route == "HOD" {
			newStatus = "APPROVED"
		} else if route == "BOTH" {
			newStatus = "PRINCIPAL_PENDING"
		} else {
			newStatus = "APPROVED"
		}

	case "REJECTED":
		newStatus = "REJECTED"

	case "CHANGES_REQUIRED":
		newStatus = "HOD_CHANGES_REQUIRED"

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status":     newStatus,
			"hodRemark":  req.Remark,
			"reviewedBy": "HOD",
			"reviewedAt": time.Now(),
		},
	}

	_, err = col.UpdateByID(ctx, objID, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update event"})
		return
	}

	// if HOD is the final approver, create notification here
	if newStatus == "APPROVED" {
		eventDate, _ := time.Parse("2006-01-02", existing.Date)
		notifyDate := eventDate.Add(-24 * time.Hour)

		notification := bson.M{
			"eventId":  objID,
			"title":    existing.Title,
			"date":     existing.Date,
			"dept":     existing.Dept,
			"notifyAt": notifyDate,
			"sent":     false,
		}

		config.DB.Collection("notifications").InsertOne(context.TODO(), notification)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "HOD decision applied",
		"status":  newStatus,
	})
}

// ✅ PRINCIPAL decision
func DecideEvent(c *gin.Context) {
	id := c.Param("id")
	objID, _ := primitive.ObjectIDFromHex(id)

	var req DecideReq
	c.BindJSON(&req)

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	col.UpdateByID(ctx, objID, bson.M{
		"$set": bson.M{
			"status":          req.Status,
			"principalRemark": req.Remark,
			"reviewedBy":      "Principal",
			"reviewedAt":      time.Now(),
		},
	})

	// ✅ Notification
	if req.Status == "APPROVED" {
		var event models.Event
		col.FindOne(ctx, bson.M{"_id": objID}).Decode(&event)

		eventDate, _ := time.Parse("2006-01-02", event.Date)
		notifyDate := eventDate.Add(-24 * time.Hour)

		notification := bson.M{
			"eventId":  objID,
			"title":    event.Title,
			"date":     event.Date,
			"dept":     event.Dept,
			"notifyAt": notifyDate,
			"sent":     false,
		}

		config.DB.Collection("notifications").InsertOne(context.TODO(), notification)

		fmt.Println("🔔 Notification created")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Event updated", "status": req.Status})
}

// helper
func EnsureUploadsDir() error {
	return os.MkdirAll("uploads", os.ModePerm)
}

// conflict check
func GetApprovedByDate(c *gin.Context) {
	date := c.Query("date")

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, _ := col.Find(ctx, bson.M{
		"status": "APPROVED",
		"date":   date,
	})
	defer cur.Close(ctx)

	var list []models.Event
	cur.All(ctx, &list)

	c.JSON(http.StatusOK, list)
}

// ✅ LIST ALL EVENTS
func ListEvents(c *gin.Context) {
	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, _ := col.Find(ctx, bson.M{})
	defer cur.Close(ctx)

	var events []models.Event
	cur.All(ctx, &events)

	c.JSON(http.StatusOK, events)
}

// ✅ PRINCIPAL PENDING EVENTS (after HOD approval)
func ListPendingEvents(c *gin.Context) {
	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, _ := col.Find(ctx, bson.M{"status": "PRINCIPAL_PENDING"})
	defer cur.Close(ctx)

	var events []models.Event
	cur.All(ctx, &events)

	c.JSON(http.StatusOK, events)
}

// ✅ APPROVED EVENTS
func ListApprovedEvents(c *gin.Context) {
	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, _ := col.Find(ctx, bson.M{"status": "APPROVED"})
	defer cur.Close(ctx)

	var events []models.Event
	cur.All(ctx, &events)

	c.JSON(http.StatusOK, events)
}
func formatTimeRange(start, end string) string {
	start = strings.TrimSpace(start)
	end = strings.TrimSpace(end)

	if start == "" && end == "" {
		return "-"
	}
	if start != "" && end != "" {
		return start + " - " + end
	}
	if start != "" {
		return start
	}
	return end
}

func filterEventsForReport(events []models.Event, dept string) []models.Event {
	var filtered []models.Event
	dept = strings.ToUpper(strings.TrimSpace(dept))

	for _, ev := range events {
		eventDept := strings.ToUpper(strings.TrimSpace(ev.Dept))

		// If no department → return all (used in yearly)
		if dept == "" {
			filtered = append(filtered, ev)
			continue
		}

		// ONLY selected department
		if eventDept == dept {
			filtered = append(filtered, ev)
		}
	}

	return filtered
}
func generateEventsPDF(c *gin.Context, title string, subtitle string, events []models.Event, fileName string) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetTitle(title, false)
	pdf.SetMargins(10, 10, 10)
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 11)
	pdf.SetTextColor(160, 80, 80)
	pdf.CellFormat(0, 6, "SPSPM'S", "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 8, "NBN Sinhgad College of Engineering, Solapur", "", 1, "C", false, 0, "")

	pdf.SetDrawColor(120, 80, 80)
	y := pdf.GetY()
	pdf.Line(15, y, 195, y)
	pdf.Ln(4)

	pdf.SetTextColor(120, 70, 120)
	pdf.SetFont("Arial", "B", 14)
	pdf.CellFormat(0, 8, title, "", 1, "C", false, 0, "")

	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(0, 7, subtitle, "", 1, "C", false, 0, "")

	pdf.CellFormat(0, 7, "Date: "+time.Now().Format("02/01/2006"), "", 1, "R", false, 0, "")
	pdf.Ln(4)

	// Table Header
	headers := []string{"Sr No", "Date", "Time", "Event Title", "Dept", "Type"}
	widths := []float64{15, 28, 30, 75, 22, 20}

	pdf.SetFillColor(240, 240, 240)
	pdf.SetFont("Arial", "B", 10)
	for i, h := range headers {
		pdf.CellFormat(widths[i], 10, h, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 9)

	if len(events) == 0 {
		pdf.CellFormat(190, 10, "No events found.", "1", 1, "C", false, 0, "")
	} else {
		for i, ev := range events {
			timeText := formatTimeRange(ev.StartTime, ev.EndTime)

			row := []string{
				fmt.Sprintf("%d", i+1),
				ev.Date,
				timeText,
				ev.Title,
				ev.Dept,
				ev.Type,
			}

			xStart := pdf.GetX()
			yStart := pdf.GetY()
			maxHeight := 8.0

			for j, txt := range row {
				x := pdf.GetX()
				y := pdf.GetY()

				pdf.MultiCell(widths[j], 8, txt, "1", "L", false)
				cellHeight := pdf.GetY() - y
				if cellHeight > maxHeight {
					maxHeight = cellHeight
				}
				pdf.SetXY(x+widths[j], y)
			}

			pdf.SetXY(xStart, yStart)
			for j := range row {
				pdf.CellFormat(widths[j], maxHeight, "", "1", 0, "", false, 0, "")
			}
			pdf.Ln(-1)

			pdf.SetXY(xStart, yStart)
			for j, txt := range row {
				x := pdf.GetX()
				y := pdf.GetY()

				pdf.MultiCell(widths[j], 8, txt, "", "L", false)
				pdf.SetXY(x+widths[j], y)
			}
			pdf.Ln(maxHeight)
		}
	}

	pdf.Ln(5)
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 8, "Generated on: "+time.Now().Format("02-01-2006 03:04 PM"), "", 1, "R", false, 0, "")

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", `attachment; filename="`+fileName+`"`)

	err := pdf.Output(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}
}

func DownloadSemesterEventsPDF(c *gin.Context) {
	year := strings.TrimSpace(c.Query("year"))
	semester := strings.TrimSpace(c.Query("semester"))
	dept := strings.TrimSpace(c.Query("dept"))

	if year == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Year is required"})
		return
	}
	if semester == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Semester is required"})
		return
	}

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, err := col.Find(ctx, bson.M{
		"date": bson.M{
			"$regex": "^" + year + "-",
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch semester events"})
		return
	}
	defer cur.Close(ctx)

	var allEvents []models.Event
	if err := cur.All(ctx, &allEvents); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read semester events"})
		return
	}

	var semesterEvents []models.Event

	for _, ev := range allEvents {
		if len(ev.Date) < 7 {
			continue
		}

		monthPart := ev.Date[5:7]

		if semester == "1" {
			if monthPart >= "07" && monthPart <= "12" {
				semesterEvents = append(semesterEvents, ev)
			}
		} else if semester == "2" {
			if monthPart >= "01" && monthPart <= "06" {
				semesterEvents = append(semesterEvents, ev)
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Semester must be 1 or 2"})
			return
		}
	}

	semesterEvents = filterEventsForReport(semesterEvents, dept)

	subtitle := ""
	if semester == "1" {
		subtitle = "Academic Calendar " + year + "-" + year[2:] + " Semester-I (July to December)"
	} else {
		subtitle = "Academic Calendar " + year + "-" + year[2:] + " Semester-II (January to June)"
	}

	if dept != "" {
		subtitle += " - " + strings.ToUpper(dept)
	} else {
		subtitle += " - All Departments"
	}

	generateEventsPDF(
		c,
		"Academic Calendar",
		subtitle,
		semesterEvents,
		"semester_"+semester+"_events_"+year+".pdf",
	)
}
func DownloadYearlyEventsPDF(c *gin.Context) {
	year := strings.TrimSpace(c.Query("year"))

	if year == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Year is required"})
		return
	}

	col := config.DB.Collection("events")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, err := col.Find(ctx, bson.M{
		"date": bson.M{
			"$regex": "^" + year,
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch yearly events"})
		return
	}
	defer cur.Close(ctx)

	var events []models.Event
	if err := cur.All(ctx, &events); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read yearly events"})
		return
	}

	generateEventsPDF(
		c,
		"Academic Calendar",
		"Academic Calendar "+year+" - All Departments",
		events,
		"yearly_events_"+year+".pdf",
	)
}
