"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";

const Dashboard = () => {
  const [roomData, setRoomData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useQueryState("search", {
    defaultValue: "",
  });
  const [buildingFilter, setBuildingFilter] = useQueryState("building", {
    defaultValue: "",
  });
  const [genderFilter, setGenderFilter] = useQueryState("gender", {
    defaultValue: "",
  });
  const [locationFilter, setLocationFilter] = useQueryState("location", {
    defaultValue: "",
  });
  const [intervalDuration, setIntervalDuration] = useState(5); // Default interval duration in minutes
  const lastFetchTimeRef = useRef(0);
  const [lastUpdated, setLastUpdated] = useState(null); // Store the timestamp from API
  const [timeElapsed, setTimeElapsed] = useState("0s"); // Time elapsed since last update
  const [minBeds, setMinBeds] = useQueryState(
    "minBeds",
    parseAsInteger.withDefault(0),
  );

  const fetchRoomData = async () => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      return; // Rate limit: wait at least 1 second between fetches
    }
    lastFetchTimeRef.current = now;

    try {
      const response = await fetch("https://proxy-housing.12458.workers.dev");
      if (!response.ok) {
        throw new Error("Failed to fetch room data");
      }
      const data = await response.json();
      setRoomData(data);

      // Get the most recent LastUpdated timestamp from the data
      if (data.length > 0) {
        const timestamps = data.map((room) =>
          new Date(room.LastUpdated).getTime(),
        );
        const latestTimestamp = new Date(Math.max(...timestamps));
        setLastUpdated(latestTimestamp);
      }

      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Function to format the elapsed time
  const formatTimeElapsed = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ${seconds % 60}s`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  };

  // Update elapsed time counter every second
  useEffect(() => {
    if (!lastUpdated) return;

    const timer = setInterval(() => {
      const elapsed = new Date() - lastUpdated;
      setTimeElapsed(formatTimeElapsed(elapsed));
    }, 1000);

    return () => clearInterval(timer);
  }, [lastUpdated]);

  useEffect(() => {
    fetchRoomData(); // Initial fetch

    const interval = setInterval(() => {
      fetchRoomData();
    }, intervalDuration * 60000); // Convert minutes to milliseconds

    return () => clearInterval(interval); // Clear interval on component unmount
  }, [intervalDuration]);

  const capacityMapping = {
    "4 person": 4,
    "6 person": 6,
    "7 person": 7,
    Quad: 4,
    Double: 2,
    Triple: 3,
    Suite: 2,
  };

  /** @type {Record<string, "west" | "east">}*/
  const locationMapping = {
    "North Avenue East": "East",
    "North Avenue North": "East",
    "North Avenue South": "East",
    "North Avenue West": "East",
    "Graduate Living Center": "West",
    "Center Street North": "West",
    "Center Street South": "West",
    Crecine: "West",
    Maulding: "West",
    "Zbar (SSA)": "West",
    "Nelson-Shell (ULC)": "West",
    Armstrong: "West",
    Brown: "East",
    "Caldwell (Explore)": "West",
    Fitten: "West",
    "Folk (Explore)": "West",
    Freeman: "West",
    Fulmer: "West",
    Glenn: "East",
    Hanson: "East",
    Harrison: "East",
    Hefner: "West",
    "Perry (GL Leadership)": "East",
    Smith: "East",
    "Woodruff North": "West",
    "Woodruff South": "West",
  };

  const groupedAndFilteredRooms = useMemo(() => {
    if (!roomData.length) return {};

    const filtered = roomData.filter((room) => {
      const matchesSearch = Object.values(room).some((value) =>
        value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
      );
      const matchesBuilding = buildingFilter
        ? room.BuildingName === buildingFilter
        : true;

      const matchesGender = genderFilter
        ? genderFilter === "Male"
          ? room.Gender === "Male" || room.Gender === "DynamicGender"
          : genderFilter === "Female"
            ? room.Gender === "Female" || room.Gender === "DynamicGender"
            : room.Gender === genderFilter
        : true;

      const matchesLocation = locationFilter
        ? locationMapping[room.BuildingName] === locationFilter
        : true;
      return (
        matchesSearch && matchesBuilding && matchesGender && matchesLocation
      );
    });

    // First group the rooms
    const grouped = filtered.reduce((acc, room) => {
      if (!acc[room.BuildingName]) {
        acc[room.BuildingName] = {};
      }
      const baseRoomNumber = room.RoomNumber.replace(/[A-G]$/i, "");
      if (!acc[room.BuildingName][baseRoomNumber]) {
        acc[room.BuildingName][baseRoomNumber] = [];
      }
      acc[room.BuildingName][baseRoomNumber].push(room);
      return acc;
    }, {});

    // Then filter by min beds if needed
    if (minBeds > 0) {
      Object.keys(grouped).forEach((building) => {
        Object.keys(grouped[building]).forEach((roomNumber) => {
          const rooms = grouped[building][roomNumber];
          const availableBeds = rooms.length;
          if (availableBeds < minBeds) {
            delete grouped[building][roomNumber];
          }
        });

        // Remove empty buildings
        if (Object.keys(grouped[building]).length === 0) {
          delete grouped[building];
        }
      });
    }

    return grouped;
  }, [
    roomData,
    searchTerm,
    buildingFilter,
    genderFilter,
    locationFilter,
    minBeds,
  ]);

  const buildings = useMemo(
    () => [...new Set(roomData.map((room) => room.BuildingName))],
    [roomData],
  );
  const genders = useMemo(
    () => [...new Set(roomData.map((room) => room.Gender))],
    [roomData],
  );

  const getAvailabilityString = (rooms) => {
    const totalBeds = rooms.reduce((sum, room) => {
      const capacity = capacityMapping[room.Capacity];
      return capacity ? capacity : sum;
    }, 0);
    const availableBeds = rooms.length;
    return `${availableBeds}/${totalBeds} beds available`;
  };

  const getAvailabilityPercentage = (rooms) => {
    const totalBeds = rooms.reduce((sum, room) => {
      const capacity = capacityMapping[room.Capacity];
      return capacity ? capacity : sum;
    }, 0);
    const availableBeds = rooms.length;
    return (availableBeds / totalBeds) * 100;
  };

  const getBackgroundColor = (availabilityPercentage) => {
    if (availabilityPercentage >= 75) return "bg-green-500";
    if (availabilityPercentage >= 50) return "bg-yellow-500";
    if (availabilityPercentage >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  if (isLoading) return <div className="text-center py-10">Loading...</div>;
  if (error)
    return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-4">
        GT Housing Room Availability Dashboard
      </h2>

      {/* Data freshness information */}
      <div className="mb-4 flex items-center space-x-2">
        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium text-sm">
          Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "Unknown"}
        </div>
        <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium text-sm flex items-center">
          <span className="mr-1 w-32 inline-block">Time since update:</span>
          <span className="font-bold min-w-16 inline-block">{timeElapsed}</span>
        </div>
        <button
          onClick={fetchRoomData}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          Refresh Now
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow p-2 border rounded bg-white dark:bg-slate-800"
        />
        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="p-2 border rounded bg-white dark:bg-slate-800"
        >
          <option value="">All Buildings</option>
          {buildings.map((building) => (
            <option key={building} value={building}>
              {building}
            </option>
          ))}
        </select>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="p-2 border rounded bg-white dark:bg-slate-800"
        >
          <option value="">All Genders</option>
          <option value="Male" className="bg-white dark:bg-slate-800">
            Male (includes Dynamic)
          </option>
          <option value="Female" className="bg-white dark:bg-slate-800">
            Female (includes Dynamic)
          </option>
          {genders
            .filter((gender) => gender !== "Male" && gender !== "Female")
            .map((gender) => (
              <option
                key={gender}
                value={gender}
                className="bg-white dark:bg-slate-800"
              >
                {gender}
              </option>
            ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="p-2 border rounded bg-white dark:bg-slate-800"
        >
          <option value="">All Locations</option>
          <option
            key="West"
            value="West"
            className="bg-white dark:bg-slate-800"
          >
            West
          </option>
          <option value="East" className="bg-white dark:bg-slate-800">
            East
          </option>
        </select>
        <div>
          <label className="block mb-1" htmlFor="interval">
            Refresh interval (min):
          </label>
          <input
            type="number"
            id="interval"
            placeholder="1-30"
            value={intervalDuration}
            min="1"
            max="30"
            onChange={(e) =>
              setIntervalDuration(
                Math.max(1, Math.min(30, Number(e.target.value))),
              )
            }
            className="p-2 border rounded bg-white dark:bg-slate-800 w-full"
          />
        </div>
        <div>
          <label className="block mb-1" htmlFor="minBeds">
            Min. beds available:
          </label>
          <input
            type="number"
            id="minBeds"
            placeholder="0+"
            value={minBeds}
            min="0"
            onChange={(e) =>
              setMinBeds(Math.max(0, parseInt(e.target.value) || 0))
            }
            className="p-2 border rounded bg-white dark:bg-slate-800 w-full"
          />
        </div>
      </div>
      <div className="space-y-6">
        {Object.entries(groupedAndFilteredRooms).map(
          ([building, roomGroups]) => (
            <div key={building} className="border-t pt-4">
              <h3 className="text-xl font-semibold mb-2">
                {building}: {locationMapping[building]}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(roomGroups).map(([baseRoomNumber, rooms]) => {
                  const availabilityPercentage =
                    getAvailabilityPercentage(rooms);
                  const bgColor = getBackgroundColor(availabilityPercentage);
                  return (
                    <div
                      key={baseRoomNumber}
                      className={`p-4 rounded-lg shadow ${bgColor}`}
                    >
                      <h4 className="font-bold text-lg mb-2">
                        {baseRoomNumber}
                      </h4>
                      <p className="font-semibold">
                        {getAvailabilityString(rooms)}
                      </p>
                      <p>Gender: {rooms[0].Gender}</p>
                      <p>Term: {rooms[0].Term}</p>
                      <div className="mt-2">
                        {rooms.map((room, index) => (
                          <span
                            key={index}
                            className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1"
                          >
                            {room.RoomNumber.slice(-1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
};

export default Dashboard;

