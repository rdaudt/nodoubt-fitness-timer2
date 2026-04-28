## HIIT Timer Management
## Timer attributes
A Timer has the following mandatory attributes: 
- Name
- Number of Stations
- Number of Rounds per station
- Work Time
- Rest Time
- Station Transition Time
- Start Station Work Manually
- Time Between Warmup and HIIT Session Beginning
- Warmup
- Warmup time
- Cooldown
- Cooldown time
- Total Time
Total Time is calculated by the app by the sum of the following:
- Warmup Interval time
+ sum work/rest activities done in a station * number of stations  
- (number of stations - 1) * Station Transition Time
- Cooldown Time
Total Time is the only Timer's calculated attribute. All other attributes are collected by the app according to the rules below:
- Timer Name can't be null or blank. It must be up to 25 chars long. It must be unique within the users Timers
- Number of Stations must be 1 or greater, with no upper boundary
- Number of Rounds per Station must be 1 or greater, with no upper boundary
- All times are expressed in minutes and seconds
- Station Transition Time, Work Time and Rest Time must be 1 second or greater, with no upper boundary
- Warmup attribute is ON/OFF. Default is ON. User is only allowed to enter Warmup Time when Warmup is ON. If user Sets Warmup OFF then the app sets Warmup Time to zero seconds and doesn't allow user to edit it.
- Cooldown attribute is ON/OFF. Default is ON. User is only allowed to enter Cooldown Time when Cooldown is ON. If user Sets Cooldown OFF then the app sets Cooldown Time to zero seconds and doesn't allow user to edit it.
- Warmup and Cooldown times must be greater than zero when the user is allowed to inform them
- Start Station Work Manually can be ON or OFF. Default is OFF
- Attribute Time Between Warmup and HIIT Session Beginning must 
## Timer CRUD
Users can create any number of Timers.
User can delete and edit timers. All timers attributes can be edited.
## Timer Run
- If Warmup time is greater than zero then the app runs the countdown for the warmup time
- At the completion of the warmup time the app pauses and waits for user to manually start the first round in the first station if the app is in Coach Mode and the Timer's attribute Start Station Work Manually is ON. In any other situation, the app start running the first work round automatically
- The app runs countdowns for cycles of work/rest until it reaches the configured Number of Rounds per station (remember that the last round is always work only, no rest)
- At the end of all rounds in a station the app starts the Station Transition Time if this is not the last Station. Otherwise, the app starts the cooldown countdown if Cooldown Time is greater than zero or the timer stops if no cooldown time was configured.
- When the app completes the Station Transition Time countdown, if the app is in Coach Mode and the Timer's attribute Start Station Work Manually is ON then the app pauses and waits for the coach to manually starts the work in the next station. Otherwise, the app automatically starts it.


