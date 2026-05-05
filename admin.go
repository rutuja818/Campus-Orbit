package handlers

import (
	"context"
	"net/http"
	"os"
	"time"

	"campus-orbit/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type RecentUser struct {
	FullName   string `bson:"fullName" json:"fullName"`
	Email      string `bson:"email" json:"email"`
	Role       string `bson:"role" json:"role"`
	Department string `bson:"department" json:"department"`
}

type RecentEvent struct {
	Title     string `bson:"title" json:"title"`
	Dept      string `bson:"dept" json:"dept"`
	Date      string `bson:"date" json:"date"`
	Status    string `bson:"status" json:"status"`
	CreatedBy string `bson:"createdBy" json:"createdBy"`
}

type RecentReport struct {
	Title     string `bson:"title" json:"title"`
	Dept      string `bson:"dept" json:"dept"`
	CreatedBy string `bson:"createdBy" json:"createdBy"`
	Date      string `bson:"date" json:"date"`
}

type AdminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func AdminLogin(c *gin.Context) {
	var req AdminLoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	jwtSecret := os.Getenv("JWT_SECRET")

	if adminEmail == "" || adminPassword == "" || jwtSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin credentials not configured in server"})
		return
	}

	if req.Email != adminEmail || req.Password != adminPassword {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin email or password"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": req.Email,
		"role":  "Admin",
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Admin login successful",
		"token":   tokenString,
		"user": gin.H{
			"email": req.Email,
			"role":  "Admin",
			"name":  "Admin",
		},
	})
}

func GetAdminDashboard(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	usersCol := config.DB.Collection("users")
	eventsCol := config.DB.Collection("events")
	reportsCol := config.DB.Collection("reports")

	totalUsers, _ := usersCol.CountDocuments(ctx, bson.M{})
	totalEvents, _ := eventsCol.CountDocuments(ctx, bson.M{})
	totalReports, _ := reportsCol.CountDocuments(ctx, bson.M{})

	pendingEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"status": "PENDING"})
	approvedEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"status": "APPROVED"})
	rejectedEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"status": "REJECTED"})

	studentCount, _ := usersCol.CountDocuments(ctx, bson.M{"role": "Student"})
	staffCount, _ := usersCol.CountDocuments(ctx, bson.M{"role": "Staff"})
	hodCount, _ := usersCol.CountDocuments(ctx, bson.M{"role": "HOD"})
	principalCount, _ := usersCol.CountDocuments(ctx, bson.M{"role": "Principal"})
	adminCount, _ := usersCol.CountDocuments(ctx, bson.M{"role": "Admin"})

	cseUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "CSE"})
	entcUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "ENTC"})
	electUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "ELECT"})
	mechUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "MECH"})
	civilUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "CIVIL"})
	centralUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "Central"})
	gseUsers, _ := usersCol.CountDocuments(ctx, bson.M{"department": "GSE"})

	cseEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "CSE"})
	entcEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "ENTC"})
	electEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "ELECT"})
	mechEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "MECH"})
	civilEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "CIVIL"})
	centralEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "Central"})
	gseEvents, _ := eventsCol.CountDocuments(ctx, bson.M{"dept": "GSE"})

	var recentUsers []RecentUser
	userFindOptions := options.Find().
		SetSort(bson.D{{Key: "_id", Value: -1}}).
		SetLimit(5)

	userCursor, err := usersCol.Find(ctx, bson.M{}, userFindOptions)
	if err == nil {
		defer userCursor.Close(ctx)
		for userCursor.Next(ctx) {
			var u RecentUser
			if err := userCursor.Decode(&u); err == nil {
				recentUsers = append(recentUsers, u)
			}
		}
	}

	var recentEvents []RecentEvent
	eventFindOptions := options.Find().
		SetSort(bson.D{{Key: "_id", Value: -1}}).
		SetLimit(5)

	eventCursor, err := eventsCol.Find(ctx, bson.M{}, eventFindOptions)
	if err == nil {
		defer eventCursor.Close(ctx)
		for eventCursor.Next(ctx) {
			var e RecentEvent
			if err := eventCursor.Decode(&e); err == nil {
				recentEvents = append(recentEvents, e)
			}
		}
	}

	var recentReports []RecentReport
	reportFindOptions := options.Find().
		SetSort(bson.D{{Key: "_id", Value: -1}}).
		SetLimit(5)

	reportCursor, err := reportsCol.Find(ctx, bson.M{}, reportFindOptions)
	if err == nil {
		defer reportCursor.Close(ctx)
		for reportCursor.Next(ctx) {
			var r RecentReport
			if err := reportCursor.Decode(&r); err == nil {
				recentReports = append(recentReports, r)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"totalUsers":     totalUsers,
		"totalEvents":    totalEvents,
		"pendingEvents":  pendingEvents,
		"approvedEvents": approvedEvents,
		"rejectedEvents": rejectedEvents,
		"totalReports":   totalReports,

		"usersByRole": gin.H{
			"Student":   studentCount,
			"Staff":     staffCount,
			"HOD":       hodCount,
			"Principal": principalCount,
			"Admin":     adminCount,
		},

		"usersByDepartment": gin.H{
			"CSE":     cseUsers,
			"ENTC":    entcUsers,
			"ELECT":   electUsers,
			"MECH":    mechUsers,
			"CIVIL":   civilUsers,
			"Central": centralUsers,
			"GSE":     gseUsers,
		},

		"eventsByDepartment": gin.H{
			"CSE":     cseEvents,
			"ENTC":    entcEvents,
			"ELECT":   electEvents,
			"MECH":    mechEvents,
			"CIVIL":   civilEvents,
			"Central": centralEvents,
			"GSE":     gseEvents,
		},

		"recentUsers":   recentUsers,
		"recentEvents":  recentEvents,
		"recentReports": recentReports,
	})
}
