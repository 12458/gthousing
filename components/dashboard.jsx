"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

const Dashboard = () => {
  const [roomData, setRoomData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [intervalDuration, setIntervalDuration] = useState(5); // Default interval duration in minutes
  const lastFetchTimeRef = useRef(0);


  const fetchRoomData = async () => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      return; // Rate limit: wait at least 1 second between fetches
    }
    lastFetchTimeRef.current = now;

    try {
      const response = await fetch('https://proxy-housing.12458.workers.dev');
      if (!response.ok) {
        throw new Error('Failed to fetch room data');
      }
      const data = await response.json();
      setRoomData(data);
      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomData(); // Initial fetch

    const interval = setInterval(() => {
      fetchRoomData();
    }, intervalDuration * 60000); // Convert minutes to milliseconds

    return () => clearInterval(interval); // Clear interval on component unmount
  }, [intervalDuration]);

  const capacityMapping = {
    '4 person': 4,
    '6 person': 6,
    '7 person': 7,
    'Quad': 4,
    'Double': 2,
    'Triple': 3,
    'Suite': 2,
  };

  /** @type {Record<string, "west" | "east">}*/
  const locationMapping = {
    "Armstrong": "West",
    "Brown": "East",
    "Caldwell (Explore)": "West",
    "Fitten": "West",
    "Folk (Explore)": "West",
    "Freeman": "West",
    "Fulmer": "West",
    "Glenn": "East",
    "Hanson": "East",
    "Harrison": "East",
    "Hefner": "West",
    "Perry (GL Leadership)": "East",
    "Smith": "East",
    "Woodruff North": "West",
    "Woodruff South": "West",
  }

  const groupedAndFilteredRooms = useMemo(() => {
    if (!roomData.length) return {};

    const filtered = roomData.filter(room => {
      const matchesSearch = Object.values(room).some(value =>
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesBuilding = buildingFilter ? room.BuildingName === buildingFilter : true;
      const matchesGender = genderFilter ? room.Gender === genderFilter : true;
      const matchesLocation = locationFilter ? locationMapping[room.BuildingName] === locationFilter : true;
      console.log(room.BuildingName, matchesLocation, locationFilter);
      return matchesSearch && matchesBuilding && matchesGender && matchesLocation;
    });

    return filtered.reduce((acc, room) => {
      if (!acc[room.BuildingName]) {
        acc[room.BuildingName] = {};
      }
      const baseRoomNumber = room.RoomNumber.replace(/[A-G]$/i, '');
      if (!acc[room.BuildingName][baseRoomNumber]) {
        acc[room.BuildingName][baseRoomNumber] = [];
      }
      acc[room.BuildingName][baseRoomNumber].push(room);
      return acc;
    }, {});
  }, [roomData, searchTerm, buildingFilter, genderFilter, locationFilter]);

  const buildings = useMemo(() => [...new Set(roomData.map(room => room.BuildingName))], [roomData]);
  const genders = useMemo(() => [...new Set(roomData.map(room => room.Gender))], [roomData]);

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
    if (availabilityPercentage >= 75) return 'bg-green-500';
    if (availabilityPercentage >= 50) return 'bg-yellow-500';
    if (availabilityPercentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (isLoading) return <div className="text-center py-10">Loading...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-4">GT Housing Room Availability Dashboard</h2>
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
          {buildings.map(building => (
            <option key={building} value={building}>{building}</option>
          ))}
        </select>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="p-2 border rounded bg-white dark:bg-slate-800"
        >
          <option value="">All Genders</option>
          {genders.map(gender => (
            <option key={gender} value={gender} className='bg-white dark:bg-slate-800'>{gender}</option>
          ))}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className='p-2 border rounded bg-white dark:bg-slate-800'>
          <option value="">All Locations</option>
          <option key="West" value="West" className="bg-white dark:bg-slate-800">West</option>
          <option value="East" className="bg-white dark:bg-slate-800">East</option>
        </select>
        <div>
          <label className="block mb-1" htmlFor="interval">Refresh interval (min):</label>
          <input
            type="number"
            id="interval"
            placeholder="1-30"
            value={intervalDuration}
            min="1"
            max="30"
            onChange={(e) => setIntervalDuration(Math.max(1, Math.min(30, Number(e.target.value))))}
            className="p-2 border rounded bg-white dark:bg-slate-800 w-full"
          />
        </div>
      </div>
      <div className="space-y-6">
        {Object.entries(groupedAndFilteredRooms).map(([building, roomGroups]) => (
          <div key={building} className="border-t pt-4">
            <h3 className="text-xl font-semibold mb-2">{building}: {locationMapping[building]}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(roomGroups).map(([baseRoomNumber, rooms]) => {
                const availabilityPercentage = getAvailabilityPercentage(rooms);
                const bgColor = getBackgroundColor(availabilityPercentage);
                return (
                  <div
                    key={baseRoomNumber}
                    className={`p-4 rounded-lg shadow ${bgColor}`}
                  >
                    <h4 className="font-bold text-lg mb-2">{baseRoomNumber}</h4>
                    <p className="font-semibold">{getAvailabilityString(rooms)}</p>
                    <p>Gender: {rooms[0].Gender}</p>
                    <p>Term: {rooms[0].Term}</p>
                    <div className="mt-2">
                      {rooms.map((room, index) => (
                        <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1">
                          {room.RoomNumber.slice(-1)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
