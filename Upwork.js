var dba = require('./workRepo.js');

//start -->
dba.connect('mongodb://ahmed:ibrahim#1@cupbots-shard-00-02-oiwfs.mongodb.net:27017,cupbots-shard-00-02-oiwfs.mongodb.net:27017,cupbots-shard-00-02-oiwfs.mongodb.net:27017/bookbot?ssl=true&replicaSet=Cupbots-shard-0&authSource=admin'
  ,function(err){ if (err) {
    console.log('Unable to connect to Mongo.')
    process.exit(1)
  } else {

    console.log('connected');

   	// 			var Ob  = 
    // 			{_id:'12312312',
				// Name:'Ahmed',
				// Email:'Ahmed@as.com',
				// phone:01119093531}
    // 			Insert(Ob);

	   //  var col = dba.get().collection('bookbot');
	   //  col.findOne({_id:'12312312'}).toArray(function(err,doc)
	   //  {
	   //  	if(!err)
	   //  	{
	   //  		console.log(doc[0].Name);
	   //  	}

	   //  })
   // 

  }
})


//--end -- Put the code in the app.js ..

function Insert(object)
{
	var mycol = dba.get().collection('bookbot');

	mycol.insert(object,function(err,done)
	{
		if(!err)
		{
			console.log('Done inserting recored ..');
		}

	})


}