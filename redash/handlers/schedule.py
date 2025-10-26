from datetime import datetime, timedelta
from flask import request
from flask_restful import Resource
from sqlalchemy import and_, func

from redash.handlers.base import BaseResource
from redash.models import Query, db
from redash.permissions import require_permission


class ScheduleStatsResource(BaseResource):
    @require_permission("list_queries")
    def get(self):
        """
        Get statistics of scheduled queries over a date range.
        
        Query parameters:
        - start_date: Start date (YYYY-MM-DD format)
        - end_date: End date (YYYY-MM-DD format)
        """
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        
        # Default to last 30 days if no dates provided
        if not start_date_str or not end_date_str:
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=30)
        else:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                return {"error": "Invalid date format. Use YYYY-MM-DD"}, 400

        # Generate date series for the chart
        current_date = start_date
        date_counts = []
        
        while current_date <= end_date:
            # Count queries that had schedules active on this date
            # We look at queries that:
            # 1. Have a schedule (schedule is not null)
            # 2. Were created before or on this date
            # 3. If they have an 'until' date, it should be after this date
            
            query_count = (
                db.session.query(func.count(Query.id))
                .filter(
                    and_(
                        func.jsonb_typeof(Query.schedule) != "null",
                        Query.created_at <= current_date,
                        Query.is_archived.is_(False)
                    )
                )
                .scalar()
            )
            
            # Filter out queries that have expired schedules
            queries_with_schedules = (
                db.session.query(Query)
                .filter(
                    and_(
                        func.jsonb_typeof(Query.schedule) != "null",
                        Query.created_at <= current_date,
                        Query.is_archived.is_(False)
                    )
                )
                .all()
            )
            
            active_count = 0
            for query in queries_with_schedules:
                if query.schedule:
                    # Check if schedule was active on this date
                    if "until" in query.schedule and query.schedule["until"]:
                        try:
                            until_date = datetime.strptime(query.schedule["until"], "%Y-%m-%d").date()
                            if until_date > current_date:
                                active_count += 1
                        except (ValueError, TypeError):
                            # If until date is invalid, consider it active
                            active_count += 1
                    else:
                        # No until date means it's active
                        active_count += 1
            
            date_counts.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "count": active_count
            })
            
            current_date += timedelta(days=1)
        
        return date_counts