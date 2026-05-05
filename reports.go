package handlers

import (
	"context"
	"net/http"
	"time"

	"campus-orbit/config"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

type Report struct {
	Title     string    `bson:"title" json:"title"`
	Details   string    `bson:"details" json:"details"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
}

// POST /api/reports  (create a simple report)
func CreateReport(c *gin.Context) {
	var r Report
	if err := c.BindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}
	if r.Title == "" || r.Details == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and details required"})
		return
	}

	r.CreatedAt = time.Now()

	col := config.DB.Collection("reports")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := col.InsertOne(ctx, r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB insert failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Report created"})
}

// GET /api/reports (list all reports)
func ListReports(c *gin.Context) {
	col := config.DB.Collection("reports")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cur, err := col.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB read failed"})
		return
	}
	defer cur.Close(ctx)

	var list []Report
	if err := cur.All(ctx, &list); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB decode failed"})
		return
	}

	c.JSON(http.StatusOK, list)
}
