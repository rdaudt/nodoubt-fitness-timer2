## Stations
Often, in HIIT training at a fitness facility (gym) the coach prepares several physically distinct workout spots and break the larger group in smaller teams or pairs. These spots are called stations. Different activities are done at each station. The coach rotates the groups/pairs in sequence across the stations. Often, when all groups/pairs went over all the stations it means the end of the HIIT session.
## Rounds
In each station, trainees will repeat cycles of one short period of high intensity work followed by a period of rest. Each cycle is called a Round. The number of rounds defines the number of times that the trainee performs a cycle in station.
Example: 3 rounds mean that the trainees will perform, in sequence, the following activities
1. HIIT work
2. Rest
3. HIIT Work
4. Rest
5. HIIT Work
Note that there is never Rest in the last round in a Station. This is because after the last round in a Station, trainees will get a Station Transition Rest period.
For practical matters, coaches will usually schedule the same number of Rounds for all stations.
## Warmup
Most coaches will schedule a warmup time in which the group stays in the same place doing light work to warm the body before the HIIT work starts. This is optional, though.
## Cooldown
Most coaches will schedule a cooldown time once trainees went over all stations. This is optional, though.
## Workout
At each station the coach schedules and runs the same sequence of HIIT burst (work) and rest. This sequence of work/rest intervals at each station is called a Workout. The workout repeats at every station.
## Station Transition Time
Once a round is complete in a station the coach allows trainees some time to rest and move to another station. This time is the Station Transition Time.
## HIIT Timer (Timer)
A HIIT Timer is a Timer created to support an instance of a HIIT session. 
A HIIT Timer is defined by the following:
- Timer Name
- Number of stations
- Number of Rounds per station
- Station Transition Time
- Warmup time
- Cooldown time
- Total Time
The number of HIIT stations must be at least one in each Timer.
Every HIIT Timer must have at least one workout and the workout must have at least one work interval.
There shall always be a rest interval between two work intervals in a workout. the last interval in a workout must be a work interval.
Warmup interval runs only once at the start of the timer, prior to the workout in the first station. Warmup intervals are optional.
Cooldown intervals run once all the groups/pairs are rotated through all stations. 
Cooldown intervals are optional.
The total time of a Timer is the sum of Warmup Interval time + (sum of the work/rest intervals times in the workout) * number of stations + station  
## App Mode
A Timer can run in two modes: Coach and Trainee. In this app, it will be set by the user by configuring an ON/OFF Coach Mode parameter. 
The app's user experience is slightly different depending on Coach Mode being ON or OFF. 
See business rules and UI/UX regarding such differences.